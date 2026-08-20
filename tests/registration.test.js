import { describe, expect, it } from 'vitest'
import { validateRegistration } from '../src/utils/validation'

const valid = {
  displayName: 'Soumyadeep',
  chatId: 'soumyadeep',
  password: 'Hushh2024!',
  confirmPassword: 'Hushh2024!',
  securityQuestionId: 1,
  securityAnswer: '  REX  ',
}

describe('registration validation', () => {
  it('accepts a valid registration', () => {
    expect(validateRegistration(valid)).toEqual({})
  })

  it('requires a display name', () => {
    expect(validateRegistration({ ...valid, displayName: '' }).displayName).toBeTruthy()
    expect(validateRegistration({ ...valid, displayName: '   ' }).displayName).toBeTruthy()
  })

  it('rejects invalid Chat IDs', () => {
    expect(validateRegistration({ ...valid, chatId: 'bad id!' }).chatId).toBeTruthy()
    expect(validateRegistration({ ...valid, chatId: 'ab' }).chatId).toBeTruthy()
  })

  it('rejects weak passwords', () => {
    expect(validateRegistration({ ...valid, password: 'short' }).password).toBeTruthy()
    expect(validateRegistration({ ...valid, password: 'onlyletters' }).password).toBeTruthy()
    expect(validateRegistration({ ...valid, password: '12345678' }).password).toBeTruthy()
  })

  it('requires matching password confirmation', () => {
    expect(validateRegistration({ ...valid, confirmPassword: 'different!' }).confirmPassword).toBeTruthy()
  })

  it('requires a valid security question id', () => {
    expect(validateRegistration({ ...valid, securityQuestionId: 999 }).securityQuestion).toBeTruthy()
    expect(validateRegistration({ ...valid, securityQuestionId: '' }).securityQuestion).toBeTruthy()
  })

  it('requires a security answer', () => {
    expect(validateRegistration({ ...valid, securityAnswer: '' }).securityAnswer).toBeTruthy()
    expect(validateRegistration({ ...valid, securityAnswer: '   ' }).securityAnswer).toBeTruthy()
  })
})
