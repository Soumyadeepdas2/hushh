

export const MAX_FAILED_ATTEMPTS = 5
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
export const LOCKOUT_MS = 15 * 60 * 1000
export const STALE_ATTEMPTS_OLDER_THAN_MS = 24 * 60 * 60 * 1000

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

export function isCurrentlyLocked(lockedUntil, nowMs) {
  if (!lockedUntil) return false
  return new Date(lockedUntil).getTime() > nowMs
}
