import { describe, expect, it } from 'vitest'
import {
  chatIdsAreSame,
  isValidChatId,
  normalizeChatId,
} from '../src/utils/chatId'
import { validateRegistration } from '../src/utils/validation'

// ---------------------------------------------------------------------------
// Chat ID canonicalization security tests (audit item 1).
//
// Canonicalization must be IDENTICAL wherever a Chat ID is created, stored,
// looked up, converted to the internal Auth email, used at login, and checked
// for uniqueness. The rule is: trim + lowercase over an ASCII-only charset
// (letters, digits, hyphen). Everything outside that charset is REJECTED, so
// no two visually-equivalent inputs can ever produce separate identities.
// ---------------------------------------------------------------------------

describe('canonicalization: equivalent inputs collapse to ONE identity', () => {
  const variants = ['ABC', 'abc', 'AbC', '  ABC  ', '\tAbC\n', 'aBc', 'ABC'.toLowerCase()]

  it('all case/spacing variants of "abc" normalize to the same value', () => {
    const normalized = variants.map(normalizeChatId)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('abc')
  })

  it('chatIdsAreSame is reflexive for all variants', () => {
    for (const a of variants) {
      for (const b of variants) {
        expect(chatIdsAreSame(a, b)).toBe(true)
      }
    }
  })

  it('hyphen placement matters — different Chat IDs stay different', () => {
    expect(chatIdsAreSame('a-b', 'ab')).toBe(false)
    expect(chatIdsAreSame('ab-c', 'abc')).toBe(false)
    expect(chatIdsAreSame('ch-7k92xp', 'CH-7K92XP')).toBe(true)
  })
})

describe('canonicalization: hostile input is REJECTED, not silently normalized', () => {
  const invalid = [
    'café', // Unicode — outside ASCII charset
    'İstanbul', // Unicode capital I with dot — JS/Postgres case-fold divergence
    'straße', // ß has no stable 1:1 ASCII case-fold
    '東京',
    'привет',
    'has space',
    '  has  spaces  ',
    'tab\tinside',
    'newline\ninside',
    'has_underscore',
    'has.dot',
    'has@symbol',
    "soumyadeep'; DROP TABLE profiles;--", // SQL injection attempt
    "OR '1'='1",
    'x%y', // LIKE wildcard
    'x_y', // LIKE wildcard
    'x\\y',
    'has/slash',
    'has+plus',
    'has=equal',
    'has,comma',
    'a<b>c',
    'a&b',
    '"quoted"',
    "'quoted'",
  ]

  it('rejects every hostile input as a Chat ID', () => {
    for (const value of invalid) {
      expect(isValidChatId(value), `expected "${value}" to be rejected`).toBe(false)
    }
  })

  it('rejects hostile inputs in full registration validation', () => {
    const base = {
      displayName: 'Test',
      password: 'Hushh2024!',
      confirmPassword: 'Hushh2024!',
      securityQuestionId: 1,
      securityAnswer: 'rex',
    }
    for (const value of invalid) {
      const errors = validateRegistration({ ...base, chatId: value })
      expect(errors.chatId, `expected chatId "${value}" to fail validation`).toBeTruthy()
    }
  })

  it('normalizeChatId never emits uppercase, spaces or invalid characters', () => {
    const samples = ['ABC', '  MiXeD-1  ', 'ch-7k92xp', 'XYZ123']
    for (const s of samples) {
      const n = normalizeChatId(s)
      expect(n).toBe(n.toLowerCase())
      expect(n).toBe(n.trim())
      expect(/^[a-z0-9-]*$/.test(n)).toBe(true)
    }
  })
})

describe('canonicalization: length boundaries are enforced', () => {
  it('rejects IDs outside 3–20 characters', () => {
    expect(isValidChatId('ab')).toBe(false)
    expect(isValidChatId('a'.repeat(21))).toBe(false)
    expect(isValidChatId('a'.repeat(20))).toBe(true)
    expect(isValidChatId('abc')).toBe(true)
  })

  it('rejects a bare hyphen run (no alphanumeric content)', () => {
    expect(isValidChatId('---')).toBe(false)
    expect(isValidChatId('a--')).toBe(true)
  })
})

describe('canonicalization: SQL LIKE wildcards cannot influence search semantics', () => {
  it('isValidChatId blocks LIKE wildcard characters entirely', () => {
    expect(isValidChatId('%')).toBe(false)
    expect(isValidChatId('_')).toBe(false)
    expect(isValidChatId('a%b')).toBe(false)
    expect(isValidChatId('a_b')).toBe(false)
  })
})
