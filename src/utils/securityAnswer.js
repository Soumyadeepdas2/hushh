

export const SECURITY_ANSWER_MAX_LENGTH = 200

export function normalizeSecurityAnswer(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}
