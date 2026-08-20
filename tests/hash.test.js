import { describe, expect, it } from 'vitest'
import { generateSaltHex, pbkdf2Hex, sha256Hex, toHex } from '../src/utils/hash'

describe('SHA-256', () => {
  it('matches the known test vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('changes when input changes', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'))
  })
})

describe('PBKDF2', () => {
  it('derives a 256-bit key', async () => {
    const salt = await generateSaltHex()
    const hash = await pbkdf2Hex('hunter2', salt, 1000)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for identical inputs', async () => {
    const salt = await generateSaltHex()
    const a = await pbkdf2Hex('answer', salt, 1000)
    const b = await pbkdf2Hex('answer', salt, 1000)
    expect(a).toBe(b)
  })
})

describe('hex helpers', () => {
  it('round-trips bytes through hex', () => {
    const bytes = new Uint8Array([0, 15, 255, 128])
    expect(toHex(bytes)).toBe('000fff80')
  })
})
