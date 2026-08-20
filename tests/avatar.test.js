import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AVATAR_COUNT, avatarPath, isValidAvatarId } from '../src/utils/avatar'

// ---------------------------------------------------------------------------
// Fixed avatar gallery (D) — pure logic + asset presence.
// ---------------------------------------------------------------------------

const root = process.cwd()

describe('avatar id validation', () => {
  it('accepts ids 1..12', () => {
    for (let i = 1; i <= AVATAR_COUNT; i += 1) {
      expect(isValidAvatarId(i)).toBe(true)
    }
  })

  it('rejects out-of-range, null, string and non-integer values', () => {
    expect(isValidAvatarId(0)).toBe(false)
    expect(isValidAvatarId(13)).toBe(false)
    expect(isValidAvatarId(-1)).toBe(false)
    expect(isValidAvatarId(null)).toBe(false)
    expect(isValidAvatarId(undefined)).toBe(false)
    expect(isValidAvatarId('1')).toBe(false)
    expect(isValidAvatarId(1.5)).toBe(false)
  })
})

describe('avatarPath', () => {
  it('maps ids to zero-padded asset paths', () => {
    expect(avatarPath(1)).toBe('/avatars/avatar-01.png')
    expect(avatarPath(12)).toBe('/avatars/avatar-12.png')
    expect(avatarPath('4')).toBe('/avatars/avatar-04.png')
  })

  it('returns null for invalid ids (callers fall back to initials)', () => {
    expect(avatarPath(null)).toBeNull()
    expect(avatarPath(0)).toBeNull()
    expect(avatarPath(99)).toBeNull()
  })
})

describe('avatar assets exist in the bundle', () => {
  it('ships all 12 avatar images', () => {
    for (let i = 1; i <= AVATAR_COUNT; i += 1) {
      const p = resolve(root, 'public/avatars', `avatar-${String(i).padStart(2, '0')}.png`)
      expect(existsSync(p), `missing ${p}`).toBe(true)
    }
  })

  it('Chat / sidebar components use the Avatar component (no duplicate rendering)', () => {
    const chat = readFileSync(resolve(root, 'src/pages/Chat.jsx'), 'utf8')
    expect(chat).toContain("import Avatar from '../components/Avatar'")
    expect(chat).toContain('<SettingsMenu')
    const list = readFileSync(resolve(root, 'src/components/ConversationList.jsx'), 'utf8')
    expect(list).toContain("import Avatar from './Avatar'")
  })
})
