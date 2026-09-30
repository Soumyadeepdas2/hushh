

import { randomBytes } from './hash'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GROUP_LENGTH = 4
const GROUP_COUNT = 7

const RECOVERY_ID_RE = new RegExp(
  `^RC-([${ALPHABET}]{${GROUP_LENGTH}}-){${GROUP_COUNT - 1}}[${ALPHABET}]{${GROUP_LENGTH}}$`,
)

function randomGroup() {
  const bytes = randomBytes(GROUP_LENGTH)
  let group = ''
  for (const byte of bytes) {
    group += ALPHABET[byte % ALPHABET.length]
  }
  return group
}

export function generateRecoveryId() {
  const groups = []
  for (let i = 0; i < GROUP_COUNT; i += 1) groups.push(randomGroup())
  return `RC-${groups.join('-')}`
}

export function normalizeRecoveryId(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toUpperCase()
}

export function isValidRecoveryId(raw) {
  if (typeof raw !== 'string') return false
  return RECOVERY_ID_RE.test(normalizeRecoveryId(raw))
}
