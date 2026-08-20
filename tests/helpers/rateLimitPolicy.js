// ---------------------------------------------------------------------------
// hushh — recovery rate-limit policy (shared test module)
// ---------------------------------------------------------------------------
// Pure mirror of the rate-limit policy enforced atomically in SQL by
// public.record_recovery_attempt() (supabase/migrations/0004_hardening.sql).
//
// The recover-password Edge Function (supabase/functions/recover-password/
// index.ts) inlines the same constants so it stays a single self-contained
// file that can be pasted into the Supabase Dashboard Edge Function editor.
// tests/edgeFunctionSecurity.test.js asserts the two never drift apart.
//
// Policy (v1, per the product spec):
//   5 failed attempts within 15 minutes → lock recovery for 15 minutes.
// ---------------------------------------------------------------------------

export const MAX_FAILED_ATTEMPTS = 5
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
export const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
export const STALE_ATTEMPTS_OLDER_THAN_MS = 24 * 60 * 60 * 1000 // purge rows older than 24h

/**
 * Pure mirror of the server-side rate-limit transition:
 * given the previous attempt record (or null) and the current time,
 * compute the next attempt count and lock state.
 *
 * @param {{ attemptCount: number, updatedAt: string } | null} prev
 * @param {number} nowMs
 * @param {{ windowMs?: number, maxAttempts?: number, lockMs?: number }} [opts]
 * @returns {{ attemptCount: number, lockedUntil: string | null }}
 */
export function computeNextAttemptState(prev, nowMs, opts = {}) {
  const windowMs = opts.windowMs ?? ATTEMPT_WINDOW_MS
  const maxAttempts = opts.maxAttempts ?? MAX_FAILED_ATTEMPTS
  const lockMs = opts.lockMs ?? LOCKOUT_MS

  const withinWindow =
    prev !== null && nowMs - new Date(prev.updatedAt).getTime() <= windowMs
  const attemptCount = withinWindow ? prev.attemptCount + 1 : 1
  const lockedUntil =
    attemptCount >= maxAttempts ? new Date(nowMs + lockMs).toISOString() : null

  return { attemptCount, lockedUntil }
}

/**
 * True when the lock has not yet expired. `lockedUntil` is an ISO timestamp
 * (or null when never locked).
 *
 * @param {string | null} lockedUntil
 * @param {number} nowMs
 * @returns {boolean}
 */
export function isCurrentlyLocked(lockedUntil, nowMs) {
  if (!lockedUntil) return false
  return new Date(lockedUntil).getTime() > nowMs
}
