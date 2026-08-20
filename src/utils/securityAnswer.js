// ---------------------------------------------------------------------------
// Security answer handling.
//
// The security answer is a low-entropy human secret, so it is NEVER stored in
// plaintext. We normalize it consistently and store ONLY a PBKDF2 hash with a
// unique random salt per user (see hash.js).
//
// Normalization is applied identically in the browser (registration) and in
// the recover-password Edge Function (verification): trim, lowercase,
// collapse repeated whitespace.
// ---------------------------------------------------------------------------

export const SECURITY_ANSWER_MAX_LENGTH = 200

export function normalizeSecurityAnswer(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}
