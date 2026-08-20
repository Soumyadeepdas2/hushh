import { describe, expect, it } from 'vitest'
import { normalizeSecurityAnswer } from '../src/utils/securityAnswer'
import { generateSaltHex, pbkdf2Hex } from '../src/utils/hash'

describe('security answer normalization', () => {
  it('trims whitespace', () => {
    expect(normalizeSecurityAnswer('  REX  ')).toBe('rex')
  })

  it('is case-insensitive', () => {
    expect(normalizeSecurityAnswer('Rex')).toBe('rex')
    expect(normalizeSecurityAnswer('REX')).toBe('rex')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeSecurityAnswer('  First   Second ')).toBe('first second')
  })

  it('handles non-strings gracefully', () => {
    expect(normalizeSecurityAnswer(null)).toBe('')
    expect(normalizeSecurityAnswer(undefined)).toBe('')
  })
})

describe('security answer hashing (PBKDF2 with per-user salt)', () => {
  it('is deterministic for the same password and salt', async () => {
    const salt = await generateSaltHex()
    const a = await pbkdf2Hex('rex', salt)
    const b = await pbkdf2Hex('rex', salt)
    expect(a).toBe(b)
  })

  it('produces different hashes for different salts', async () => {
    const saltA = await generateSaltHex()
    const saltB = await generateSaltHex()
    const a = await pbkdf2Hex('rex', saltA)
    const b = await pbkdf2Hex('rex', saltB)
    expect(a).not.toBe(b)
  })

  it('produces different hashes for different answers', async () => {
    const salt = await generateSaltHex()
    const a = await pbkdf2Hex('rex', salt)
    const b = await pbkdf2Hex('another answer', salt)
    expect(a).not.toBe(b)
  })

  it('matches normalized answers', async () => {
    const salt = await generateSaltHex()
    const a = await pbkdf2Hex(normalizeSecurityAnswer('  REX  '), salt)
    const b = await pbkdf2Hex(normalizeSecurityAnswer('rex'), salt)
    expect(a).toBe(b)
  })

  it('emits a 64-char hex digest (256 bits)', async () => {
    const salt = await generateSaltHex()
    const hash = await pbkdf2Hex('rex', salt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
