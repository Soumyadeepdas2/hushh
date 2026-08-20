import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Migration 0006 — unread counts, delete chat (for me), avatars.
// Static pins on the migration source so security properties can't regress.
// ---------------------------------------------------------------------------

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(new URL(p, `file://${root}`), 'utf8')
const m6 = read('supabase/migrations/0006_unread_delete_avatars.sql')
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()

describe('migration 0006 — schema additions', () => {
  it('adds the read cursor and avatar_id columns', () => {
    expect(norm(m6)).toContain('add column if not exists last_read_at timestamptz not null default now()')
    expect(norm(m6)).toContain('add column if not exists avatar_id smallint')
  })

  it('validates avatar_id against the gallery range (1..12)', () => {
    expect(norm(m6)).toContain('check (avatar_id is null or (avatar_id between 1 and 12))')
  })
})

describe('migration 0006 — security-definer functions are hardened', () => {
  // NOTE: search by prefix — the CREATE signatures include parameter names
  // (e.g. mark_conversation_read(p_conversation_id uuid)).
  const fns = [
    'public.get_unread_counts()',
    'public.mark_conversation_read(',
    'public.list_my_conversations()',
    'public.delete_conversation_for_me(',
    'public.set_avatar(',
  ]

  it.each(fns)('%s is SECURITY DEFINER with fixed search_path', (fn) => {
    const idx = norm(m6).indexOf(`create or replace function ${fn}`)
    expect(idx).toBeGreaterThanOrEqual(0)
    const block = norm(m6).slice(idx, idx + 3000)
    expect(block).toContain('security definer')
    expect(block).toContain('set search_path = public')
  })

  it('each function is granted ONLY to authenticated', () => {
    // grant lines use the signature with TYPES (no parameter names)
    const grantFns = [
      'public.get_unread_counts()',
      'public.mark_conversation_read(uuid)',
      'public.list_my_conversations()',
      'public.delete_conversation_for_me(uuid)',
      'public.set_avatar(smallint)',
    ]
    for (const fn of grantFns) {
      expect(norm(m6)).toContain(`grant execute on function ${fn} to authenticated`)
    }
  })

  it('delete_conversation_for_me verifies membership and removes only MY row', () => {
    const idx = norm(m6).indexOf('create or replace function public.delete_conversation_for_me(')
    const block = norm(m6).slice(idx, idx + 2500)
    expect(block).toContain('public.is_conversation_participant(p_conversation_id)')
    expect(block).toContain('conversation_id = p_conversation_id and user_id = v_me')
    // message rows are NOT deleted (shared with the other participant)
    expect(block).not.toContain('delete from public.messages')
    // conversation is removed only when no participants remain
    expect(block).toContain('not exists (')
  })

  it('get_unread_counts excludes my own and soft-deleted messages', () => {
    const idx = norm(m6).indexOf('create or replace function public.get_unread_counts()')
    const block = norm(m6).slice(idx, idx + 2000)
    expect(block).toContain('m.sender_id <> cp.user_id')
    expect(block).toContain('m.deleted_at is null')
    expect(block).toContain('m.created_at > cp.last_read_at')
  })

  it('set_avatar validates the gallery range server-side', () => {
    const idx = norm(m6).indexOf('create or replace function public.set_avatar(')
    const block = norm(m6).slice(idx, idx + 1500)
    expect(block).toContain('p_avatar_id < 1 or p_avatar_id > 12')
  })

  it('public profile functions return ONLY public columns (incl. avatar_id)', () => {
    const sql = norm(m6)
    expect(sql).toContain('returns table (id uuid, display_name text, chat_id text, avatar_id smallint)')
    // the returned column list never includes auth_user_id or recovery data
    expect(sql).not.toContain('select p.auth_user_id')
    expect(sql).not.toContain('recovery')
  })

  it('does not weaken RLS or grant anything to anon', () => {
    expect(norm(m6)).not.toContain('disable row level security')
    expect(norm(m6)).not.toContain('to anon')
  })
})
