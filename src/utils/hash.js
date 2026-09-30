

export const PBKDF2_ITERATIONS = 210_000
export const HASH_BYTES = 32

function getCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto
  }
  throw new Error('Web Crypto API is not available in this environment.')
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length)
  getCrypto().getRandomValues(bytes)
  return bytes
}

export function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function fromHex(hex) {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return bytes
}

export async function sha256Hex(input) {
  const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

export async function pbkdf2Hex(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const salt = fromHex(saltHex)
  const keyMaterial = await getCrypto().subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await getCrypto().subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  )
  return toHex(new Uint8Array(bits))
}

export async function generateSaltHex(length = 16) {
  return toHex(randomBytes(length))
}
