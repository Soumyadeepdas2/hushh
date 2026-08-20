import { describe, expect, it } from 'vitest'
import {
  ATTEMPT_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  computeNextAttemptState,
  isCurrentlyLocked,
} from './helpers/rateLimitPolicy'

// ---------------------------------------------------------------------------
// Recovery rate-limiting policy tests (audit item 5).
//
// The policy: 5 failed attempts within 15 minutes → 15-minute lockout.
// The atomic server-side enforcement lives in the SQL upsert
// (migration 0004); this module is the exact pure mirror of those semantics,
// so unit tests here pin the policy that the SQL must implement.
// ---------------------------------------------------------------------------

const T0 = Date.parse('2026-01-01T00:00:00.000Z')

function iso(ms) {
  return new Date(ms).toISOString()
}

describe('rate-limit constants', () => {
  it('pins the policy values (5 attempts / 15 min window / 15 min lock)', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5)
    expect(ATTEMPT_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(LOCKOUT_MS).toBe(15 * 60 * 1000)
  })
})

describe('computeNextAttemptState', () => {
  it('first attempt starts at 1 and is not locked', () => {
    const state = computeNextAttemptState(null, T0)
    expect(state).toEqual({ attemptCount: 1, lockedUntil: null })
  })

  it('counts consecutive attempts within the window', () => {
    let prev = null
    let now = T0
    for (let i = 1; i <= 4; i += 1) {
      const state = computeNextAttemptState(prev, now)
      expect(state.attemptCount).toBe(i)
      expect(state.lockedUntil).toBeNull()
      prev = { attemptCount: state.attemptCount, updatedAt: iso(now) }
      now += 60_000 // 1 minute later — still inside the window
    }
  })

  it('locks exactly on the 5th failed attempt within the window', () => {
    let prev = null
    let now = T0
    let state = null
    for (let i = 1; i <= 5; i += 1) {
      state = computeNextAttemptState(prev, now)
      prev = { attemptCount: state.attemptCount, updatedAt: iso(now) }
      now += 60_000
    }
    expect(state.attemptCount).toBe(5)
    expect(state.lockedUntil).toBe(iso(T0 + 4 * 60_000 + LOCKOUT_MS))
  })

  it('resets the counter when the previous attempt is outside the 15-min window', () => {
    // attempt at T0, next attempt 16 minutes later → window expired → count resets to 1
    const state = computeNextAttemptState(
      { attemptCount: 4, updatedAt: iso(T0) },
      T0 + ATTEMPT_WINDOW_MS + 60_000,
    )
    expect(state.attemptCount).toBe(1)
    expect(state.lockedUntil).toBeNull()
  })

  it('a lock is released once the lockout period has elapsed', () => {
    const lockedAt = T0
    const lockExpires = iso(lockedAt + LOCKOUT_MS)
    expect(isCurrentlyLocked(lockExpires, lockedAt)).toBe(true)
    expect(isCurrentlyLocked(lockExpires, lockedAt + LOCKOUT_MS - 1)).toBe(true)
    expect(isCurrentlyLocked(lockExpires, lockedAt + LOCKOUT_MS)).toBe(false)
    expect(isCurrentlyLocked(null, lockedAt)).toBe(false)
  })

  it('a fresh attempt after lock expiry starts a new window', () => {
    // 5 attempts at T0..T0+4min → locked until T0+19min; attempt at T0+20min resets
    let prev = null
    let now = T0
    let state = null
    for (let i = 1; i <= 5; i += 1) {
      state = computeNextAttemptState(prev, now)
      prev = { attemptCount: state.attemptCount, updatedAt: iso(now) }
      now += 60_000
    }
    expect(state.lockedUntil).toBe(iso(T0 + 4 * 60_000 + LOCKOUT_MS))

    const after = computeNextAttemptState(prev, T0 + 20 * 60_000)
    expect(after.attemptCount).toBe(1)
    expect(after.lockedUntil).toBeNull()
  })
})
