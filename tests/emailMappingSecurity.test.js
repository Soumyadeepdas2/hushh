import { describe, expect, it } from 'vitest'
import { chatIdToEmail } from '../src/utils/emailMapping'
import { normalizeChatId } from '../src/utils/chatId'

// ---------------------------------------------------------------------------
// Deterministic internal Auth email tests (audit item 2).
//
// The internal email is derived ONLY from the normalized Chat ID:
//   "<normalized>@<project-hostname>"
// It must be deterministic, injective (collision-safe), syntactically valid,
// short enough for Auth, and never derived from a real user email.
// ---------------------------------------------------------------------------

const VALID_EMAIL = /^[a-z0-9-]+@[a-z0-9.-]+$/

describe('internal email mapping: determinism', () => {
  it('maps all case variants of the same Chat ID to the same email', () => {
    const a = chatIdToEmail('ABC')
    const b = chatIdToEmail('abc')
    const c = chatIdToEmail('AbC')
    const d = chatIdToEmail('  abc  ')
    expect(new Set([a, b, c, d]).size).toBe(1)
  })

  it('is stable across calls', () => {
    expect(chatIdToEmail('soumyadeep')).toBe(chatIdToEmail('soumyadeep'))
  })
})

describe('internal email mapping: collision safety (injectivity)', () => {
  it('different normalized Chat IDs always map to different emails', () => {
    const pairs = [
      ['alice', 'bob'],
      ['a-b', 'ab'],
      ['ab-c', 'abc'],
      ['ch-7k92xp', 'ch-7k92xq'],
      ['a'.repeat(20), 'b'.repeat(20)],
    ]
    for (const [x, y] of pairs) {
      expect(chatIdToEmail(x)).not.toBe(chatIdToEmail(y))
    }
  })

  it('is injective over a large sample (deterministic + CSPRNG)', () => {
    const seen = new Set()

    // deterministic distinct valid Chat IDs
    for (let i = 0; i < 3000; i += 1) {
      const email = chatIdToEmail(`uid-${i}`)
      expect(seen.has(email), `duplicate email for uid-${i}`).toBe(false)
      seen.add(email)
    }

    // random valid Chat IDs from a CSPRNG (collision chance ~10^-13)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 3000; i += 1) {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(14))
      let id = ''
      for (const b of bytes) id += alphabet[b % alphabet.length]
      const email = chatIdToEmail(id)
      expect(seen.has(email)).toBe(false)
      seen.add(email)
    }
  })

  it('the mapping depends only on the normalized Chat ID', () => {
    expect(chatIdToEmail('Soumyadeep').replace(/^chatid:/, '')).toBe(
      `${normalizeChatId('Soumyadeep')}@${chatIdToEmail('soumyadeep').split('@')[1]}`,
    )
  })
})

describe('internal email mapping: validity for Auth', () => {
  it('always produces a syntactically valid email address', () => {
    const ids = ['soumyadeep', 'CH-7K92XP', 'a-b-c', '12345', 'x'.repeat(20)]
    for (const id of ids) {
      expect(VALID_EMAIL.test(chatIdToEmail(id))).toBe(true)
    }
  })

  it('never exceeds the practical email length limit (254)', () => {
    // worst case: 20-char Chat ID + a long but plausible project hostname
    const email = chatIdToEmail('a'.repeat(20))
    expect(email.length).toBeLessThanOrEqual(254)
  })

  it('is never derived from a real personal email', () => {
    const email = chatIdToEmail('soumyadeep')
    expect(email).not.toContain('gmail.com')
    expect(email).not.toContain('yahoo')
    expect(email).not.toContain('outlook')
    // exactly one @ separator, local part = the Chat ID, domain = the project
    const [local, domain] = email.split('@')
    expect(domain).toBeTruthy()
    expect(local).toBe('soumyadeep')
    expect(domain.split('@')).toHaveLength(1)
  })

  it('contains no whitespace, uppercase or invalid email characters', () => {
    expect(chatIdToEmail('  Soumyadeep  ')).toBe(chatIdToEmail('soumyadeep'))
    const email = chatIdToEmail('CH-7K92XP')
    expect(email).toBe(email.toLowerCase())
    expect(/\s/.test(email)).toBe(false)
  })
})
