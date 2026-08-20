// ============================================================================
// hushh — recover-password Edge Function (Deno / Supabase Edge Runtime)
// ============================================================================
//
// This is the ONLY server-side component in hushh, and it exists for one
// reason: a logged-out browser must never be able to perform an
// administrative password reset directly.
//
// DEPLOYMENT (Supabase Dashboard — no CLI, no Docker, no local Deno):
//   This file is deliberately SELF-CONTAINED (no local imports) so it can be
//   pasted as-is into the Dashboard Edge Function editor.
//
//   Dashboard steps:
//     1. Open your hushh Supabase project in the Dashboard.
//     2. Sidebar → Edge Functions → "Create a new function".
//        (If `recover-password` already exists from an earlier attempt,
//        open it instead and skip to step 4.)
//     3. Name the function EXACTLY:   recover-password
//     4. Delete the boilerplate and paste the ENTIRE contents of this file
//        into the editor (index.ts).
//     5. Deploy.
//     6. Open the deployed function → Settings → turn OFF
//        "Enforce JWT verification" (equivalent to the CLI's
//        `--no-verify-jwt`). This is required: password recovery happens
//        while the user is logged OUT, so the function must be public. It is
//        protected by its own server-side rate limiting instead.
//
// SECRETS:
//   No secrets need to be configured. Supabase automatically injects
//   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into every Edge Function in
//   the project. The service-role key exists ONLY here — it is never exposed
//   to the React frontend, never placed in Vite environment variables, and
//   never committed.
//
// Flows:
//   { action: 'lookup', recoveryId }                  -> { success, securityQuestionId }
//   { action: 'reset',  recoveryId, securityAnswer,
//                      newPassword }                  -> { success }
//
// Security properties:
//   • The Recovery ID is verified against its SHA-256 hash (never stored in
//     plaintext, never returned). IDs carry ~140 bits of CSPRNG entropy, so
//     enumeration is computationally infeasible.
//   • The security answer is verified against its PBKDF2-HMAC-SHA256 hash
//     with the per-user salt (never stored in plaintext, never returned).
//   • Failed attempts are rate-limited atomically server-side via
//     public.record_recovery_attempt(): 5 failures within 15 minutes locks
//     recovery for that Recovery ID for 15 minutes. The count update is a
//     single upsert statement (row-locked), so concurrent requests cannot
//     bypass the limit. Stale attempt rows are purged to keep the table
//     bounded even under enumeration-style floods.
//   • The new password is validated server-side, changed via the Supabase
//     Admin API (service_role), and the user's existing sessions are revoked
//     (admin sign-out) so a compromised account cannot keep old tokens.
//   • Responses are generic; hashes, salts, passwords, answers, user IDs
//     and credentials are never returned.
//
// NOTE: this single file is the canonical function AND the Dashboard paste
// source. The rate-limit constants below are mirrored by
// tests/helpers/rateLimitPolicy.js; tests/edgeFunctionSecurity.test.js
// asserts they never drift apart.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Recovery IDs are generated from this alphabet, 7 groups of 4 unambiguous
// characters (no 0/1/I/O): RC-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (~140 bits).
const RECOVERY_ID_PATTERN =
  /^RC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

// ---- rate-limit policy (mirrored by tests/helpers/rateLimitPolicy.js) ----
const MAX_FAILED_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const STALE_ATTEMPTS_OLDER_THAN_MS = 24 * 60 * 60 * 1000 // purge rows older than 24h

const PBKDF2_ITERATIONS = 210_000 // must match src/utils/hash.js
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const SECURITY_ANSWER_MAX_LENGTH = 200

const GENERIC_FAILURE = 'Incorrect Recovery ID or security answer.'
const LOCKED_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function makeAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('server configuration missing')
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

const encoder = new TextEncoder()
const utf8 = (input) => encoder.encode(input)

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', utf8(input))
  return toHex(new Uint8Array(digest))
}

async function pbkdf2(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

function normalizeRecoveryId(raw) {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : ''
}

function normalizeAnswer(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\s+/g, ' ') : ''
}

function isValidRecoveryId(value) {
  return RECOVERY_ID_PATTERN.test(value)
}

function passwordError(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.'
  if (!/\d/.test(password)) return 'Password must include at least one number.'
  return null
}

// ---------------------------------------------------------------------------
// rate limiting
//
// public.record_recovery_attempt() (migration 0004) performs the count/lock
// update as ONE atomic upsert statement (row lock on the identifier) and
// purges stale rows. The policy semantics are mirrored (for tests) in
// tests/helpers/rateLimitPolicy.js.
// ---------------------------------------------------------------------------

async function isLockedOut(client, identifier) {
  const { data, error } = await client
    .from('recovery_attempts')
    .select('locked_until')
    .eq('identifier', identifier)
    .maybeSingle()
  if (error || !data?.locked_until) return false
  return new Date(data.locked_until).getTime() > Date.now()
}

async function recordFailedAttempt(client, identifier) {
  const { error } = await client.rpc('record_recovery_attempt', {
    p_identifier: identifier,
    p_now: new Date().toISOString(),
    p_window_ms: ATTEMPT_WINDOW_MS,
    p_max_attempts: MAX_FAILED_ATTEMPTS,
    p_lock_ms: LOCKOUT_MS,
    p_purge_before: new Date(Date.now() - STALE_ATTEMPTS_OLDER_THAN_MS).toISOString(),
  })
  if (error) {
    // Rate limiting is defense-in-depth; PBKDF2 + 140-bit entropy remain the
    // primary brute-force barriers. Never surface internals to the client.
    console.error('recover-password: record_recovery_attempt failed', error.message)
  }
}

async function clearAttempts(client, identifier) {
  await client.from('recovery_attempts').delete().eq('identifier', identifier)
}

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

async function handleLookup(body) {
  const client = makeAdminClient()
  const recoveryId = normalizeRecoveryId(body.recoveryId)
  if (!isValidRecoveryId(recoveryId)) {
    return json({ success: false, error: 'That Recovery ID does not look right.' }, 400)
  }

  const identifier = await sha256Hex(recoveryId)
  if (await isLockedOut(client, identifier)) {
    return json({ success: false, error: LOCKED_MESSAGE, locked: true }, 429)
  }

  const { data: secret, error } = await client
    .from('user_secrets')
    .select('security_question_id')
    .eq('recovery_id_hash', identifier)
    .maybeSingle()

  if (error || !secret) {
    // Unknown Recovery ID — count a failure anyway so IDs cannot be probed
    // with different response behavior, and so floods are rate-limited.
    await recordFailedAttempt(client, identifier)
    return json({ success: false, error: GENERIC_FAILURE })
  }

  // Only the (public, fixed-list) question id is returned. Nothing else.
  return json({ success: true, securityQuestionId: secret.security_question_id })
}

async function handleReset(body) {
  const client = makeAdminClient()

  const recoveryId = normalizeRecoveryId(body.recoveryId)
  const securityAnswer = typeof body.securityAnswer === 'string' ? body.securityAnswer : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (!isValidRecoveryId(recoveryId)) {
    return json({ success: false, error: 'That Recovery ID does not look right.' }, 400)
  }

  const pwError = passwordError(newPassword)
  if (pwError) return json({ success: false, error: pwError }, 400)

  const normalizedAnswer = normalizeAnswer(securityAnswer)
  if (!normalizedAnswer) {
    return json({ success: false, error: 'Security answer is required.' }, 400)
  }
  if (normalizedAnswer.length > SECURITY_ANSWER_MAX_LENGTH) {
    return json({ success: false, error: 'Security answer is too long.' }, 400)
  }

  const identifier = await sha256Hex(recoveryId)
  if (await isLockedOut(client, identifier)) {
    return json({ success: false, error: LOCKED_MESSAGE, locked: true }, 429)
  }

  const { data: secret, error } = await client
    .from('user_secrets')
    .select('auth_user_id, security_answer_hash, security_answer_salt')
    .eq('recovery_id_hash', identifier)
    .maybeSingle()

  if (error || !secret) {
    await recordFailedAttempt(client, identifier)
    return json({ success: false, error: GENERIC_FAILURE })
  }

  // Verify the security answer against its PBKDF2 hash (timing-safe).
  const expected = fromHex(secret.security_answer_hash)
  const salt = fromHex(secret.security_answer_salt)
  const actual = await pbkdf2(normalizedAnswer, salt, PBKDF2_ITERATIONS)
  if (!timingSafeEqual(actual, expected)) {
    await recordFailedAttempt(client, identifier)
    return json({ success: false, error: GENERIC_FAILURE })
  }

  // Both secrets verified → change the Auth password via the Admin API.
  const { error: updateError } = await client.auth.admin.updateUserById(
    secret.auth_user_id,
    { password: newPassword },
  )
  if (updateError) {
    console.error('recover-password: admin password update failed', updateError.message)
    return json({ success: false, error: GENERIC_ERROR }, 500)
  }

  // Revoke all existing sessions for the account so stolen/old tokens cannot
  // keep using the pre-reset session. Best-effort: the password is already
  // changed, and a failure here must not surface to the client.
  try {
    await client.auth.admin.signOut(secret.auth_user_id)
  } catch (err) {
    console.error('recover-password: session revocation failed', err?.message ?? err)
  }

  await clearAttempts(client, identifier)
  return json({ success: true })
}

// ---------------------------------------------------------------------------
// entrypoint
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid request.' }, 400)
  }

  try {
    if (body.action === 'lookup') return await handleLookup(body)
    if (body.action === 'reset') return await handleReset(body)
  } catch (err) {
    console.error('recover-password: unexpected error', err?.message ?? err)
    return json({ success: false, error: GENERIC_ERROR }, 500)
  }

  return json({ success: false, error: 'Invalid action.' }, 400)
})
