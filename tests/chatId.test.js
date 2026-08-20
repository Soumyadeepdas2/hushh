import { describe, expect, it } from 'vitest'
import {
  chatIdsAreSame,
  generateChatId,
  isValidChatId,
  normalizeChatId,
} from '../src/utils/chatId'
import { chatIdToEmail } from '../src/utils/emailMapping'

describe('Chat ID normalization', () => {
  it('trims and lowercases', () => {
    expect(normalizeChatId('  Soumyadeep  ')).toBe('soumyadeep')
    expect(normalizeChatId('SOUMYADEEP')).toBe('soumyadeep')
    expect(normalizeChatId('soumyadeep')).toBe('soumyadeep')
    expect(normalizeChatId('CH-7K92XP')).toBe('ch-7k92xp')
  })

  it('treats differently-cased IDs as the same Chat ID', () => {
    expect(chatIdsAreSame('Soumyadeep', 'soumyadeep')).toBe(true)
    expect(chatIdsAreSame('SOUMYADEEP', 'soumyadeep')).toBe(true)
    expect(chatIdsAreSame('  Soumyadeep  ', 'soumyadeep')).toBe(true)
    expect(chatIdsAreSame('alice', 'bob')).toBe(false)
  })
})

describe('Chat ID validation', () => {
  it('accepts valid Chat IDs', () => {
    expect(isValidChatId('soumyadeep')).toBe(true)
    expect(isValidChatId('CH-7K92XP')).toBe(true)
    expect(isValidChatId('abc')).toBe(true)
    expect(isValidChatId('a-b-c')).toBe(true)
    expect(isValidChatId('12345')).toBe(true)
    expect(isValidChatId('a'.repeat(20))).toBe(true)
  })

  it('rejects IDs that are too short or too long', () => {
    expect(isValidChatId('ab')).toBe(false)
    expect(isValidChatId('')).toBe(false)
    expect(isValidChatId('   ')).toBe(false)
    expect(isValidChatId('a'.repeat(21))).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(isValidChatId('has space')).toBe(false)
    expect(isValidChatId('has_underscore')).toBe(false)
    expect(isValidChatId('has.dot')).toBe(false)
    expect(isValidChatId('has@symbol')).toBe(false)
    expect(isValidChatId('has/slash')).toBe(false)
  })

  it('rejects a bare run of hyphens (no alphanumeric character)', () => {
    expect(isValidChatId('---')).toBe(false)
    expect(isValidChatId('a--')).toBe(true)
  })
})

describe('Chat ID generation', () => {
  it('generates IDs in CH-XXXXXX format using unambiguous characters', () => {
    for (let i = 0; i < 100; i += 1) {
      const id = generateChatId()
      expect(id).toMatch(/^CH-[A-Z2-9]{6}$/)
      expect(id).not.toMatch(/[01IO]/)
      expect(isValidChatId(id)).toBe(true)
    }
  })

  it('produces distinct IDs in practice', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateChatId()))
    expect(ids.size).toBe(200)
  })
})

describe('Chat ID uniqueness logic', () => {
  it('maps equal normalized Chat IDs to the same internal email', () => {
    expect(chatIdToEmail('Soumyadeep')).toBe(chatIdToEmail('soumyadeep'))
    expect(chatIdToEmail('SOUMYADEEP')).toBe(chatIdToEmail('soumyadeep'))
  })

  it('maps different Chat IDs to different internal emails', () => {
    expect(chatIdToEmail('alice')).not.toBe(chatIdToEmail('bob'))
    expect(chatIdToEmail('a-b')).not.toBe(chatIdToEmail('ab'))
  })

  it('never uses a real email — the mapping is derived from the Chat ID', () => {
    const email = chatIdToEmail('soumyadeep')
    expect(email.startsWith('soumyadeep@')).toBe(true)
    expect(email).not.toContain('@gmail.com')
  })
})
