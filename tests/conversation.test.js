import { describe, expect, it } from 'vitest'
import { getConversationKey, normalizeConversationResult } from '../src/utils/conversation'

describe('conversation ID logic (1:1 deterministic key)', () => {
  const alice = '11111111-1111-1111-1111-111111111111'
  const bob = '22222222-2222-2222-2222-222222222222'

  it('is order-independent', () => {
    expect(getConversationKey(alice, bob)).toBe(getConversationKey(bob, alice))
  })

  it('is deterministic', () => {
    expect(getConversationKey(alice, bob)).toBe(getConversationKey(alice, bob))
  })

  it('differs for different participant pairs', () => {
    const carol = '33333333-3333-3333-3333-333333333333'
    expect(getConversationKey(alice, bob)).not.toBe(getConversationKey(alice, carol))
  })

  it('returns null when a participant is missing or both are the same', () => {
    expect(getConversationKey(alice, alice)).toBeNull()
    expect(getConversationKey(null, bob)).toBeNull()
    expect(getConversationKey(alice, undefined)).toBeNull()
  })

  it('produces the same key the database trigger/function computes', () => {
    // The database computes: least(a,b)::text || ':' || greatest(a,b)::text
    const dbStyle = `${[alice, bob].sort()[0]}:${[alice, bob].sort()[1]}`
    expect(getConversationKey(alice, bob)).toBe(dbStyle)
  })
})

describe('normalizeConversationResult (RPC array unwrap — "Could not load messages" fix)', () => {
  const row = {
    conversation_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    participant_ids: ['a', 'b'],
  }

  it('unwraps the PostgREST array form (TABLE(...) RPC returns an array)', () => {
    expect(normalizeConversationResult([row])).toEqual(row)
    expect(normalizeConversationResult([row, { conversation_id: 'x' }])).toEqual(row)
  })

  it('passes through an object form unchanged', () => {
    expect(normalizeConversationResult(row)).toEqual(row)
  })

  it('returns null for empty/missing results', () => {
    expect(normalizeConversationResult([])).toBeNull()
    expect(normalizeConversationResult(null)).toBeNull()
    expect(normalizeConversationResult(undefined)).toBeNull()
    expect(normalizeConversationResult(42)).toBeNull()
  })

  it('the conversation service uses the normalizer (no undefined conversation_id)', () => {
    const service = require('node:fs').readFileSync(
      require('node:path').resolve(process.cwd(), 'src/services/conversations.js'),
      'utf8',
    )
    expect(service).toContain("import { normalizeConversationResult } from '../utils/conversation'")
    expect(service).toContain('return normalizeConversationResult(data) || {}')
  })
})
