import { describe, expect, it } from 'vitest'
import { validateRecoveryInput } from '../src/utils/recovery'
import { VALID_RECOVERY_ID } from './fixtures'

describe('recovery validation', () => {
  it('requires BOTH a Recovery ID and a security answer', () => {
    const errors = validateRecoveryInput({
      recoveryId: '',
      securityAnswer: '',
      newPassword: '',
    })
    expect(errors.recoveryId).toBeTruthy()
    expect(errors.securityAnswer).toBeTruthy()
    expect(errors.newPassword).toBeTruthy()
  })

  it('accepts a complete valid input', () => {
    const errors = validateRecoveryInput({
      recoveryId: VALID_RECOVERY_ID,
      securityAnswer: 'rex',
      newPassword: 'NewPass2024!',
    })
    expect(errors).toEqual({})
  })

  it('rejects a malformed Recovery ID', () => {
    const errors = validateRecoveryInput({
      recoveryId: 'soumyadeep', // a Chat ID is NOT a Recovery ID
      securityAnswer: 'rex',
      newPassword: 'NewPass2024!',
    })
    expect(errors.recoveryId).toBeTruthy()
  })

  it('rejects a weak new password', () => {
    const errors = validateRecoveryInput({
      recoveryId: VALID_RECOVERY_ID,
      securityAnswer: 'rex',
      newPassword: 'short',
    })
    expect(errors.newPassword).toBeTruthy()
  })

  it('rejects a missing security answer even when the Recovery ID is valid', () => {
    const errors = validateRecoveryInput({
      recoveryId: VALID_RECOVERY_ID,
      securityAnswer: '   ',
      newPassword: 'NewPass2024!',
    })
    expect(errors.securityAnswer).toBeTruthy()
  })
})
