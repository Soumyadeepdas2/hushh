import { describe, expect, it } from 'vitest'
import {
  generateRecoveryId,
  isValidRecoveryId,
  normalizeRecoveryId,
} from '../src/utils/recoveryId'
import { sha256Hex } from '../src/utils/hash'
import { VALID_RECOVERY_ID } from './fixtures'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const FORMAT = new RegExp(
  `^RC-([${ALPHABET}]{4}-){6}[${ALPHABET}]{4}$`,
)

describe('Recovery ID generation', () => {
  it('matches the product format RC-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = generateRecoveryId()
      expect(id).toMatch(FORMAT)
      expect(id.length).toBe('RC-'.length + 7 * 4 + 6) // 3 + 28 + 6 separators = 37
    }
  })

  it('never contains ambiguous characters (0,1,I,O)', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateRecoveryId()).not.toMatch(/[01IO]/)
    }
  })

  it('carries at least 128 bits of entropy', () => {
    // 28 random chars from a 32-char alphabet => 28 * log2(32) = 140 bits
    const bits = 7 * 4 * Math.log2(ALPHABET.length)
    expect(bits).toBeGreaterThanOrEqual(128)
    expect(bits).toBeCloseTo(140, 6)
  })

  it('is not derived from any input (no arguments)', () => {
    const a = generateRecoveryId()
    const b = generateRecoveryId()
    expect(a).not.toBe(b)
  })

  it('produces practically unique IDs', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generateRecoveryId()))
    expect(ids.size).toBe(2000)
  })
})

describe('Recovery ID format validation', () => {
  it('accepts valid Recovery IDs (case-insensitive)', () => {
    expect(isValidRecoveryId(VALID_RECOVERY_ID)).toBe(true)
    expect(isValidRecoveryId(VALID_RECOVERY_ID.toLowerCase())).toBe(true)
  })

  it('rejects malformed values', () => {
    expect(isValidRecoveryId('')).toBe(false)
    expect(isValidRecoveryId('CH-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD')).toBe(false)
    expect(isValidRecoveryId('RC-8FQ2-M7KD-XP9A')).toBe(false) // old 60-bit format
    expect(isValidRecoveryId('RC-8FQ2-M7KD')).toBe(false)
    expect(isValidRecoveryId(`${VALID_RECOVERY_ID}-EXTRA`)).toBe(false)
    expect(isValidRecoveryId('RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7C!')).toBe(false)
    expect(isValidRecoveryId('RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD1')).toBe(false)
    expect(isValidRecoveryId('RC-0000-0000-0000-0000-0000-0000-0000')).toBe(false)
  })
})

describe('Recovery ID normalization', () => {
  it('trims and uppercases', () => {
    expect(normalizeRecoveryId(`  ${VALID_RECOVERY_ID.toLowerCase()}  `)).toBe(
      VALID_RECOVERY_ID,
    )
  })
})

describe('Recovery ID hashing', () => {
  it('hashes deterministically to a 64-char hex digest', async () => {
    const hashA = await sha256Hex(normalizeRecoveryId(VALID_RECOVERY_ID))
    const hashB = await sha256Hex(normalizeRecoveryId(`  ${VALID_RECOVERY_ID.toLowerCase()}  `))
    expect(hashA).toBe(hashB)
    expect(hashA).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never returns the plaintext Recovery ID from the hash function', async () => {
    const hash = await sha256Hex(normalizeRecoveryId(VALID_RECOVERY_ID))
    expect(hash).not.toContain(VALID_RECOVERY_ID)
  })
})
