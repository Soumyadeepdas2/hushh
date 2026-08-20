// ---------------------------------------------------------------------------
// Registration validation — pure, unit-testable business rules.
// ---------------------------------------------------------------------------

import { isValidChatId } from './chatId'
import { validatePassword } from './password'
import { normalizeSecurityAnswer, SECURITY_ANSWER_MAX_LENGTH } from './securityAnswer'
import { SECURITY_QUESTIONS } from '../data/securityQuestions'

export const DISPLAY_NAME_MAX_LENGTH = 50

export function validateRegistration(input = {}) {
  const errors = {}

  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  if (!displayName) {
    errors.displayName = 'Display name is required.'
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`
  }

  if (!isValidChatId(input.chatId)) {
    errors.chatId =
      'Chat ID must be 3–20 characters using only letters, numbers and hyphens.'
  }

  const passwordError = validatePassword(input.password)
  if (passwordError) errors.password = passwordError

  if (typeof input.confirmPassword !== 'string' || input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  const questionId = Number(input.securityQuestionId)
  if (!SECURITY_QUESTIONS.some((q) => q.id === questionId)) {
    errors.securityQuestion = 'Please choose a security question.'
  }

  const answer = normalizeSecurityAnswer(input.securityAnswer)
  if (!answer) {
    errors.securityAnswer = 'Security answer is required.'
  } else if (answer.length > SECURITY_ANSWER_MAX_LENGTH) {
    errors.securityAnswer = 'Security answer is too long.'
  }

  return errors
}
