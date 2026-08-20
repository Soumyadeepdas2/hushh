// ---------------------------------------------------------------------------
// Recovery input validation (Forgot Password flow).
//
// Password recovery requires BOTH the Recovery ID AND the security answer.
// The Chat ID is never sufficient to initiate recovery, and recovery
// information is never exposed through Chat ID search.
// ---------------------------------------------------------------------------

import { isValidRecoveryId } from './recoveryId'
import { validatePassword } from './password'
import { normalizeSecurityAnswer, SECURITY_ANSWER_MAX_LENGTH } from './securityAnswer'

export function validateRecoveryInput({ recoveryId, securityAnswer, newPassword } = {}) {
  const errors = {}

  if (!isValidRecoveryId(recoveryId)) {
    errors.recoveryId = 'That Recovery ID does not look right. Check it and try again.'
  }

  const answer = normalizeSecurityAnswer(securityAnswer)
  if (!answer) {
    errors.securityAnswer = 'Security answer is required.'
  } else if (answer.length > SECURITY_ANSWER_MAX_LENGTH) {
    errors.securityAnswer = 'Security answer is too long.'
  }

  const passwordError = validatePassword(newPassword)
  if (passwordError) errors.newPassword = passwordError

  return errors
}
