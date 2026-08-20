import { describe, expect, it } from 'vitest'
import { isValidPassword, validatePassword } from '../src/utils/password'

describe('password validation', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('Hushh2024!')).toBeNull()
    expect(isValidPassword('Hushh2024!')).toBe(true)
  })

  it('requires at least 8 characters', () => {
    expect(validatePassword('Aa1!')).toContain('at least 8')
    expect(validatePassword('')).toContain('required')
  })

  it('rejects passwords over 128 characters', () => {
    expect(validatePassword('Aa1' + 'x'.repeat(130))).toContain('at most 128')
  })

  it('requires at least one letter', () => {
    expect(validatePassword('12345678')).toContain('letter')
  })

  it('requires at least one number', () => {
    expect(validatePassword('onlyletters')).toContain('number')
  })
})
