// ---------------------------------------------------------------------------
// Hashing primitives shared by the frontend (and mirrored in the Edge
// Function). Everything here uses the standard Web Crypto API so it runs
// identically in browsers, Deno (Edge Function) and Node (tests).
//
// Rules:
//   - Passwords: handled entirely by Supabase Auth. Never hashed here.
//   - Security answers: PBKDF2-HMAC-SHA256 with a unique random salt per user.
//   - Recovery IDs: SHA-256 of the normalized ID (high-entropy secret, see
//     recoveryId.js for the rationale).
// ---------------------------------------------------------------------------

export const PBKDF2_ITERATIONS = 210_000 // OWASP recommendation for PBKDF2-SHA256
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

/**
 * SHA-256 hex digest.
 */
export async function sha256Hex(input) {
  const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(input))
  return toHex(new Uint8Array(digest))
}

/**
 * PBKDF2-HMAC-SHA256(password, saltHex, iterations) -> hex digest (256 bits).
 */
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

/**
 * A fresh random salt as hex (16 random bytes by default).
 */
export async function generateSaltHex(length = 16) {
  return toHex(randomBytes(length))
}
