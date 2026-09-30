

import { randomBytes } from './hash'

export const CHAT_ID_MIN_LENGTH = 3
export const CHAT_ID_MAX_LENGTH = 20

const CHAT_ID_CHARS_RE = /^[A-Za-z0-9-]+$/

const GENERATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GENERATED_LENGTH = 6

export function normalizeChatId(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

export function isValidChatId(raw) {
  if (typeof raw !== 'string') return false
  const value = raw.trim()
  if (value.length < CHAT_ID_MIN_LENGTH || value.length > CHAT_ID_MAX_LENGTH) return false
  if (!CHAT_ID_CHARS_RE.test(value)) return false

  if (!/[A-Za-z0-9]/.test(value)) return false
  return true
}

export function chatIdsAreSame(a, b) {
  return normalizeChatId(a) === normalizeChatId(b)
}

export function generateChatId() {
  const bytes = randomBytes(GENERATED_LENGTH)
  let suffix = ''
  for (const byte of bytes) {
    suffix += GENERATION_ALPHABET[byte % GENERATION_ALPHABET.length]
  }
  return `CH-${suffix}`
}
