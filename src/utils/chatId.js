// ---------------------------------------------------------------------------
// Chat ID handling.
//
// A Chat ID is the PUBLIC handle a hushh user is found by. It is:
//   - 3–20 characters
//   - letters, numbers, hyphens only
//   - case-insensitive (normalized to lowercase before storage)
//   - unique at the database level (profiles.chat_id_normalized UNIQUE)
//
// "Soumyadeep", "soumyadeep" and "SOUMYADEEP" are the SAME Chat ID.
// ---------------------------------------------------------------------------

import { randomBytes } from './hash'

export const CHAT_ID_MIN_LENGTH = 3
export const CHAT_ID_MAX_LENGTH = 20

const CHAT_ID_CHARS_RE = /^[A-Za-z0-9-]+$/

// Alphabet used for generated Chat IDs — excludes look-alike characters
// (0/O, 1/I/L) so generated IDs are easy to read and type.
const GENERATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GENERATED_LENGTH = 6

/**
 * Normalize a raw Chat ID for comparison/storage.
 * Trims whitespace and lowercases. "  Soumyadeep  " -> "soumyadeep".
 */
export function normalizeChatId(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

/**
 * Validate a raw Chat ID as typed by the user.
 */
export function isValidChatId(raw) {
  if (typeof raw !== 'string') return false
  const value = raw.trim()
  if (value.length < CHAT_ID_MIN_LENGTH || value.length > CHAT_ID_MAX_LENGTH) return false
  if (!CHAT_ID_CHARS_RE.test(value)) return false
  // must contain at least one letter or digit (a bare "---" is not a handle)
  if (!/[A-Za-z0-9]/.test(value)) return false
  return true
}

/**
 * Two Chat IDs refer to the same account when their normalized forms match.
 */
export function chatIdsAreSame(a, b) {
  return normalizeChatId(a) === normalizeChatId(b)
}

/**
 * Generate a random Chat ID, e.g. "CH-7K92XP".
 */
export function generateChatId() {
  const bytes = randomBytes(GENERATED_LENGTH)
  let suffix = ''
  for (const byte of bytes) {
    suffix += GENERATION_ALPHABET[byte % GENERATION_ALPHABET.length]
  }
  return `CH-${suffix}`
}
