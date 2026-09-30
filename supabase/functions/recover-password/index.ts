

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RECOVERY_ID_PATTERN =
  /^RC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/

const MAX_FAILED_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const STALE_ATTEMPTS_OLDER_THAN_MS = 24 * 60 * 60 * 1000

const PBKDF2_ITERATIONS = 210_000
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const SECURITY_ANSWER_MAX_LENGTH = 200

const GENERIC_FAILURE = 'Incorrect Recovery ID or security answer.'
const LOCKED_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'

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

    console.error('recover-password: record_recovery_attempt failed', error.message)
  }
}

async function clearAttempts(client, identifier) {
  await client.from('recovery_attempts').delete().eq('identifier', identifier)
}

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

    await recordFailedAttempt(client, identifier)
    return json({ success: false, error: GENERIC_FAILURE })
  }

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

  const expected = fromHex(secret.security_answer_hash)
  const salt = fromHex(secret.security_answer_salt)
  const actual = await pbkdf2(normalizedAnswer, salt, PBKDF2_ITERATIONS)
  if (!timingSafeEqual(actual, expected)) {
    await recordFailedAttempt(client, identifier)
    return json({ success: false, error: GENERIC_FAILURE })
  }

  const { error: updateError } = await client.auth.admin.updateUserById(
    secret.auth_user_id,
    { password: newPassword },
  )
  if (updateError) {
    console.error('recover-password: admin password update failed', updateError.message)
    return json({ success: false, error: GENERIC_ERROR }, 500)
  }

  try {
    await client.auth.admin.signOut(secret.auth_user_id)
  } catch (err) {
    console.error('recover-password: session revocation failed', err?.message ?? err)
  }

  await clearAttempts(client, identifier)
  return json({ success: true })
}

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
