import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ATTEMPT_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  STALE_ATTEMPTS_OLDER_THAN_MS,
} from './helpers/rateLimitPolicy'
import { isValidRecoveryId } from '../src/utils/recoveryId'

// ---------------------------------------------------------------------------
// Edge Function security tests (audit items 3, 4, 5, 13, 14).
//
// The recover-password Edge Function is the ONLY server-side component.
// These tests pin its security-critical properties to the actual source so
// they cannot regress silently. The live behavior matrix lives in
// scripts/security-audit-live.mjs.
// ---------------------------------------------------------------------------

const root = fileURLToPath(new URL('..', import.meta.url))
const edgePath = new URL(`file://${root}supabase/functions/recover-password/index.ts`)
const edgeSrc = readFileSync(edgePath, 'utf8')
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function extractEdgeRecoveryPattern() {
  const match = edgeSrc.match(/RECOVERY_ID_PATTERN\s*=\s*(\/.*\/[a-z]*)/)
  expect(match, 'RECOVERY_ID_PATTERN literal not found').toBeTruthy()
  const body = match[1].slice(1, match[1].lastIndexOf('/'))
  return new RegExp(body)
}

describe('recovery ID pattern in the Edge Function (140-bit format)', () => {
  it('requires exactly 7 groups of 4 unambiguous characters', () => {
    const literal = edgeSrc.match(/RECOVERY_ID_PATTERN\s*=\s*(\/.*\/[a-z]*)/)[1]
    const body = literal.slice(1, literal.lastIndexOf('/'))
    const groups = body.match(/\[ABCDEFGHJKLMNPQRSTUVWXYZ23456789\]\{4\}/g)
    expect(groups).toHaveLength(7)
    expect(body).not.toMatch(/[01IO]/)
  })

  it('is equivalent to the frontend recovery ID validation (no format drift)', () => {
    const edgePattern = extractEdgeRecoveryPattern()
    const samples = [
      'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD', // valid (new 140-bit)
      'rc-8fq2-m7kd-xp9a-g3hw-n5lb-q7cd', // valid, lowercase
      'RC-8FQ2-M7KD-XP9A', // invalid (old 60-bit)
      'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7C!', // invalid char
      'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-', // extra group
      'soumyadeep', // a Chat ID is not a Recovery ID
    ]
    for (const sample of samples) {
      expect(edgePattern.test(sample), `edge pattern on "${sample}"`).toBe(
        isValidRecoveryId(sample),
      )
    }
  })
})

describe('generic responses / no information leakage (audit item 4)', () => {
  it('returns only generic failure strings — never hashes, salts, answers or IDs', () => {
    const src = norm(edgeSrc)
    expect(src).toContain("'incorrect recovery id or security answer.'")
    expect(src).toContain("'too many attempts. please wait a few minutes and try again.'")
    expect(src).toContain("'something went wrong. please try again.'")
    expect(src).not.toContain('json({ recovery_id')
    expect(src).not.toContain('json({ security_answer')
    expect(src).not.toContain('json({ auth_user_id')
    expect(src).not.toContain('json({ password')
  })

  it('never logs secrets (no console.log at all; console.error only for non-secret messages)', () => {
    expect(edgeSrc).not.toContain('console.log')
    for (const secretVar of ['recoveryId', 'securityAnswer', 'newPassword', 'serviceRoleKey']) {
      expect(edgeSrc).not.toMatch(new RegExp(`console\\.\\w+\\s*\\([^)]*${secretVar}`))
    }
  })

  it('verifies the security answer with a timing-safe comparison', () => {
    const src = norm(edgeSrc)
    expect(src).toContain('timingsafeequal(actual, expected)')
    expect(src).toContain('pbkdf2(')
  })
})

describe('rate limiting is enforced server-side (audit item 5)', () => {
  it('passes the policy constants to the atomic SQL upsert', () => {
    const src = norm(edgeSrc)
    expect(src).toContain("client.rpc('record_recovery_attempt'")
    expect(src).toContain('p_window_ms: attempt_window_ms')
    expect(src).toContain('p_max_attempts: max_failed_attempts')
    expect(src).toContain('p_lock_ms: lockout_ms')
    expect(MAX_FAILED_ATTEMPTS).toBe(5)
    expect(ATTEMPT_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(LOCKOUT_MS).toBe(15 * 60 * 1000)
  })

  it('inlines the SAME policy constants as the test policy module (no drift)', () => {
    // The function is a single self-contained file for Dashboard pasting, so
    // its constants are inlined as literals. They must evaluate to the same
    // values as tests/helpers/rateLimitPolicy.js — this pins that invariant.
    expect(edgeSrc).toContain(`const MAX_FAILED_ATTEMPTS = ${MAX_FAILED_ATTEMPTS}`)
    // the source writes windows in minutes/hours: 15 * 60 * 1000 and 24 * 60 * 60 * 1000
    expect(edgeSrc).toContain(`const ATTEMPT_WINDOW_MS = ${ATTEMPT_WINDOW_MS / 60_000} * 60 * 1000`)
    expect(edgeSrc).toContain(`const LOCKOUT_MS = ${LOCKOUT_MS / 60_000} * 60 * 1000`)
    expect(edgeSrc).toContain(
      `const STALE_ATTEMPTS_OLDER_THAN_MS = ${STALE_ATTEMPTS_OLDER_THAN_MS / 3_600_000} * 60 * 60 * 1000`,
    )
  })

  it('checks the lock BEFORE any verification work', () => {
    const src = norm(edgeSrc)
    const resetIdx = src.indexOf('async function handlereset(')
    const resetBody = src.slice(resetIdx)
    const firstLockCheck = resetBody.indexOf('islockedout')
    const firstDbQuery = resetBody.indexOf('user_secrets')
    expect(firstLockCheck).toBeGreaterThanOrEqual(0)
    expect(firstDbQuery).toBeGreaterThan(firstLockCheck)
  })
})

describe('admin password reset behavior (audit item 13)', () => {
  it('changes the password via the Admin API only after both secrets verify', () => {
    const src = norm(edgeSrc)
    const resetIdx = src.indexOf('async function handlereset(')
    const resetBody = src.slice(resetIdx)
    const pbkdf2Idx = resetBody.indexOf('pbkdf2(')
    const adminUpdate = resetBody.indexOf('client.auth.admin.updateuserbyid')
    expect(pbkdf2Idx).toBeGreaterThan(-1)
    expect(adminUpdate).toBeGreaterThan(pbkdf2Idx)
  })

  it('revokes existing sessions after a successful reset (admin signOut)', () => {
    const src = norm(edgeSrc)
    const updateIdx = src.indexOf('client.auth.admin.updateuserbyid')
    const signOutIdx = src.indexOf('client.auth.admin.signout(')
    expect(signOutIdx).toBeGreaterThan(-1)
    expect(signOutIdx).toBeGreaterThan(updateIdx)
  })

  it('clears the attempt state after a successful recovery', () => {
    const src = norm(edgeSrc)
    const resetIdx = src.indexOf('async function handlereset(')
    const resetBody = src.slice(resetIdx)
    expect(resetBody.indexOf('clearattempts(client, identifier)')).toBeGreaterThan(
      resetBody.indexOf('updateuserbyid'),
    )
  })

  it('never writes the plaintext Recovery ID or security answer to any table', () => {
    const src = norm(edgeSrc)
    // the Edge Function never inserts rows; its only writes are the atomic
    // rate-limit RPC and the attempt-cleanup delete
    expect(src).not.toContain('.insert(')
    // user_secrets is only ever SELECTed, never written by the function
    const refs = [...src.matchAll(/from\('user_secrets'\)\s*\.\s*(\w+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    expect(refs.every((r) => r === 'select')).toBe(true)
  })
})

describe('service-role key isolation (audit item 9)', () => {
  it('the service-role key is read only from the environment, never embedded', () => {
    expect(edgeSrc).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")
    expect(edgeSrc).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/)
  })

  it('is a single self-contained file (no local imports) — Dashboard paste-ready', () => {
    // The only allowed import is the remote esm.sh client; any `./` or `../`
    // import would break when pasted into the Dashboard single-file editor.
    const imports = [...edgeSrc.matchAll(/^import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(
      (m) => m[1],
    )
    expect(imports.length).toBeGreaterThan(0)
    for (const specifier of imports) {
      expect(specifier, `unexpected local import "${specifier}"`).toMatch(/^https:\/\//)
    }
    expect(edgeSrc).not.toContain("from './")
    expect(edgeSrc).not.toContain("from '../")
  })
})
