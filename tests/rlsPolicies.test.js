import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Static RLS / schema policy tests (audit items 6, 8, 10, 11, 12).
//
// These read the actual migration files and pin the security invariants to
// them, so an accidental policy deletion/weakening fails `npm test` even
// without a live database. They complement (not replace) the live
// penetration matrix in scripts/security-audit-live.mjs.
// ---------------------------------------------------------------------------

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(new URL(p, `file://${root}`), 'utf8')
const m1 = read('supabase/migrations/0001_schema.sql')
const m2 = read('supabase/migrations/0002_rls_and_functions.sql')
const m3 = read('supabase/migrations/0003_realtime.sql')
const m4 = read('supabase/migrations/0004_hardening.sql')
const m5 = read('supabase/migrations/0005_fix_recursive_rls.sql')

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// Slice from a function's definition to the start of the NEXT function, so a
// block check can never bleed into a different function's body.
function functionBlock(sql, needle) {
  const idx = sql.indexOf(needle)
  expect(idx, `function "${needle}" not found`).toBeGreaterThanOrEqual(0)
  const next = sql.indexOf('create or replace function', idx + needle.length)
  const end = next === -1 ? sql.length : next
  return sql.slice(idx, end)
}

describe('RLS is enabled on every user-sensitive table', () => {
  const tables = [
    'profiles',
    'user_secrets',
    'conversations',
    'conversation_participants',
    'messages',
    'recovery_attempts',
  ]
  it.each(tables)('enables row level security on %s', (table) => {
    expect(norm(m2)).toContain(`alter table public.${table} enable row level security`)
  })
})

describe('profiles: own-row-only access + identity immutability', () => {
  it('has select/insert/update/delete policies scoped to auth.uid()', () => {
    const sql = norm(m2)
    expect(sql).toContain('create policy "profiles_select_own"')
    expect(sql).toContain('create policy "profiles_insert_own"')
    expect(sql).toContain('create policy "profiles_update_own"')
    expect(sql).toContain('create policy "profiles_delete_own"')
    expect(sql).toContain('auth.uid() = auth_user_id')
  })

  it('the select policy is strictly own-row (no OR widening)', () => {
    const sql = norm(m2)
    const start = sql.indexOf('create policy "profiles_select_own"')
    const end = sql.indexOf('create policy "profiles_insert_own"')
    const selectPolicy = sql.slice(start, end)
    expect(selectPolicy).toContain('auth.uid() = auth_user_id')
    expect(selectPolicy).not.toContain(' or ')
  })

  it('Chat ID / auth user id are immutable via trigger (migration 0004)', () => {
    const sql = norm(m4)
    expect(sql).toContain('profiles_prevent_identity_change')
    expect(sql).toContain("raise exception 'chat_id is immutable'")
    expect(sql).toContain("raise exception 'chat_id_normalized is immutable'")
    expect(sql).toContain('create trigger profiles_identity_immutable')
  })

  it('Chat ID uniqueness + charset are enforced at the database level', () => {
    expect(norm(m1)).toContain('create unique index if not exists profiles_chat_id_normalized_key')
    expect(norm(m1)).toContain('on public.profiles (chat_id_normalized)')
    expect(norm(m4)).toContain('profiles_chat_id_format_check')
    expect(norm(m4)).toContain("chat_id_normalized ~ '^[a-z0-9-]{3,20}$'")
  })
})

describe('user_secrets: never readable by any client role', () => {
  it('only allows inserting one’s own row', () => {
    const sql = norm(m2)
    expect(sql).toContain('create policy "user_secrets_insert_own"')
    expect(sql).toContain('auth.uid() = auth_user_id')
  })

  it('has NO select/update/delete policies', () => {
    const sql = norm(m2)
    const start = sql.indexOf('user_secrets')
    const end = sql.indexOf('conversations')
    const secretsPart = sql.slice(start, end)
    expect(secretsPart).not.toContain('for select')
    expect(secretsPart).not.toContain('for update')
    expect(secretsPart).not.toContain('for delete')
  })

  it('is revoked from anon and authenticated (defense in depth, migration 0004)', () => {
    expect(norm(m4)).toContain('revoke all on table public.user_secrets from anon, authenticated')
  })

  it('keeps exactly one client privilege on user_secrets: INSERT (registration)', () => {
    const sql = norm(m4)
    expect(sql).toContain('grant insert on table public.user_secrets to authenticated')
    // no read or write privilege beyond that insert
    expect(sql).not.toContain('grant select on table public.user_secrets')
    expect(sql).not.toContain('grant update on table public.user_secrets')
    expect(sql).not.toContain('grant delete on table public.user_secrets')
  })

  it('recovery_attempts is revoked from anon and authenticated', () => {
    expect(norm(m4)).toContain('revoke all on table public.recovery_attempts from anon, authenticated')
  })
})

describe('conversations / participants: participants only, no client writes', () => {
  it('conversations have a participant-only select policy and no other policies', () => {
    const sql = norm(m2)
    expect(sql).toContain('create policy "conversations_select_participant"')
    const start = sql.indexOf('conversations_select_participant')
    const end = sql.indexOf('participants_select_participant')
    const section = sql.slice(start, end)
    expect(section).not.toContain('create policy "conversations_')
  })

  it('participants have a participant-only select policy and no other policies', () => {
    const sql = norm(m2)
    expect(sql).toContain('create policy "participants_select_participant"')
    const start = sql.indexOf('participants_select_participant')
    const end = sql.indexOf('messages_select_participant')
    const section = sql.slice(start, end)
    expect(section).not.toContain('create policy "participants_')
  })

  it('conversations are created only by the security-definer RPC', () => {
    expect(norm(m2)).toContain('create or replace function public.get_or_create_conversation(')
    expect(norm(m2)).toContain('security definer')
    expect(norm(m2)).toContain('set search_path = public')
  })

  it('dedupe_key uniqueness prevents duplicate 1:1 conversations', () => {
    expect(norm(m1)).toContain('dedupe_key text not null unique')
    expect(norm(m2)).toContain('on conflict (dedupe_key) do nothing')
  })
})

describe('messages: participant-only, sender forced, no spoofing', () => {
  it('has the three intended RLS policies', () => {
    const sql = norm(m2)
    expect(sql).toContain('create policy "messages_select_participant"')
    expect(sql).toContain('create policy "messages_insert_participant"')
    expect(sql).toContain('create policy "messages_update_own"')
  })

  it('sender_id is derived from auth.uid(), never trusted from the client', () => {
    const sql = norm(m2)
    expect(sql).toContain(
      'sender_id = (select id from public.profiles where auth_user_id = auth.uid())',
    )
    const m4sql = norm(m4)
    expect(m4sql).toContain('messages_force_sender')
    expect(m4sql).toContain('new.sender_id := v_sender')
  })

  it('insert requires membership in the conversation', () => {
    expect(norm(m2)).toContain('cp.conversation_id = messages.conversation_id')
    expect(norm(m2)).toContain('cp.user_id = sender_id')
  })

  it('edits are blocked by trigger; only soft-delete is possible', () => {
    const m4sql = norm(m4)
    expect(m4sql).toContain("raise exception 'messages cannot be edited'")
    expect(m4sql).toContain("raise exception 'deleted messages cannot be modified'")
    expect(m4sql).toContain('create trigger messages_prevent_edit')
  })

  it('message body length is constrained at the database level', () => {
    expect(norm(m1)).toContain('char_length(body) between 1 and 2000')
  })
})

describe('security-definer functions are least-privilege', () => {
  const definerFunctions = [
    'public.chat_id_available(',
    'public.search_profiles(',
    'public.get_my_profile()',
    'public.get_profile_brief(',
    'public.get_or_create_conversation(',
    'public.touch_conversation()',
    'public.messages_force_sender()',
    'public.record_recovery_attempt(',
  ]

  it.each(definerFunctions)('%s is marked SECURITY DEFINER with a fixed search_path', (fn) => {
    const sql = `${norm(m2)} ${norm(m4)}`
    const idx = sql.indexOf(fn)
    expect(idx).toBeGreaterThanOrEqual(0)
    const block = sql.slice(idx, idx + 4000)
    expect(block).toContain('security definer')
    expect(block).toContain('set search_path = public')
  })

  it('search_profiles returns ONLY public fields (id, display_name, chat_id)', () => {
    const block = functionBlock(norm(m2), 'create or replace function public.search_profiles(')
    expect(block).toContain('returns table (id uuid, display_name text, chat_id text)')
    expect(block).not.toContain('auth_user_id')
    expect(block).not.toContain('recovery')
    expect(block).not.toContain('email')
  })

  it('search_profiles escapes LIKE wildcards (no SQL/LIKE injection)', () => {
    const block = functionBlock(norm(m2), 'create or replace function public.search_profiles(')
    expect(block).toContain("q := replace(q, '\\', '\\\\')")
    expect(block).toContain("q := replace(q, '%', '\\%')")
    expect(block).toContain("q := replace(q, '_', '\\_')")
    expect(block).toContain('like q || \'%\' escape \'\\\'')
  })

  it('get_profile_brief only returns profiles sharing a conversation with the caller', () => {
    const block = functionBlock(norm(m2), 'create or replace function public.get_profile_brief(')
    expect(block).toContain('returns table (id uuid, display_name text, chat_id text)')
    // the returned column list is the public triple only — auth_user_id is
    // used internally to resolve the caller but never SELECTed as output
    expect(block).toContain('select p.id, p.display_name, p.chat_id')
    expect(block).not.toContain('select p.auth_user_id')
    expect(block).toContain('exists (')
    expect(block).toContain('conversation_participants')
    expect(block).toContain('auth.uid()')
  })

  it('get_or_create_conversation derives the caller from auth.uid() and rejects self/unknown peers', () => {
    const block = functionBlock(norm(m2), 'create or replace function public.get_or_create_conversation(')
    expect(block).toContain('auth.uid()')
    expect(block).toContain("raise exception 'invalid_peer'")
    expect(block).toContain("raise exception 'peer_not_found'")
  })
})

describe('realtime (audit item 7)', () => {
  it('publishes only messages and conversations — never secrets or participants', () => {
    const sql = norm(m3)
    expect(sql).toContain('add table public.messages')
    expect(sql).toContain('add table public.conversations')
    expect(sql).not.toContain('user_secrets')
    expect(sql).not.toContain('recovery_attempts')
    expect(sql).not.toContain('conversation_participants')
  })

  it('the message SELECT policy is what realtime enforces (participant-only)', () => {
    expect(norm(m2)).toContain('create policy "messages_select_participant"')
  })
})

describe('grants (audit item 9)', () => {
  it('executes search/RPC functions only for authenticated users', () => {
    const sql = norm(m2)
    for (const fn of [
      'public.chat_id_available(text) to authenticated',
      'public.search_profiles(text) to authenticated',
      'public.get_my_profile() to authenticated',
      'public.get_profile_brief(uuid[]) to authenticated',
      'public.get_or_create_conversation(uuid) to authenticated',
    ]) {
      expect(sql).toContain(`grant execute on function ${fn}`)
    }
  })

  it('record_recovery_attempt is executable only by service_role', () => {
    const sql = norm(m4)
    expect(sql).toContain(
      'revoke all on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz) from public, anon, authenticated',
    )
    expect(sql).toContain(
      'grant execute on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz) to service_role',
    )
  })
})

// ---------------------------------------------------------------------------
// Migration 0005 — recursive RLS fix (BUG 1: conversations HTTP 500)
// ---------------------------------------------------------------------------

// Extract a single `create policy "name" ... ;` block (to the next
// create/drop policy or end of input).
function policyBlock(sql, policyName) {
  const needle = `create policy "${policyName}"`
  const idx = sql.indexOf(needle)
  expect(idx, `policy "${policyName}" not found`).toBeGreaterThanOrEqual(0)
  const next = sql.indexOf('create policy', idx + needle.length)
  const nextDrop = sql.indexOf('drop policy', idx + needle.length)
  const candidates = [sql.length]
  if (next !== -1) candidates.push(next)
  if (nextDrop !== -1) candidates.push(nextDrop)
  return sql.slice(idx, Math.min(...candidates))
}

describe('migration 0005 — recursive RLS fix (BUG 1: conversations HTTP 500)', () => {
  it('adds the SECURITY DEFINER participant helper with a fixed search_path', () => {
    const block = functionBlock(
      norm(m5),
      'create or replace function public.is_conversation_participant(',
    )
    expect(block).toContain('returns boolean')
    expect(block).toContain('security definer')
    expect(block).toContain('set search_path = public')
    expect(block).toContain('auth.uid()')
  })

  it('allows ONLY authenticated users to execute the helper (anonymous blocked)', () => {
    const sql = norm(m5)
    expect(sql).toContain(
      'revoke all on function public.is_conversation_participant(uuid) from public, anon',
    )
    expect(sql).toContain(
      'grant execute on function public.is_conversation_participant(uuid) to authenticated',
    )
  })

  it('recreates conversations_select_participant via the helper (no recursion)', () => {
    const block = policyBlock(norm(m5), 'conversations_select_participant')
    expect(block).toContain('using (public.is_conversation_participant(conversations.id))')
    // no inline subquery against any RLS table inside the policy
    expect(block).not.toContain('from public.conversation_participants')
    expect(block).not.toContain('from public.profiles')
  })

  it('recreates participants_select_participant via the helper (no self-reference)', () => {
    const block = policyBlock(norm(m5), 'participants_select_participant')
    expect(block).toContain(
      'using (public.is_conversation_participant(conversation_participants.conversation_id))',
    )
    expect(block).not.toContain('from public.conversation_participants')
  })

  it('recreates messages_select_participant via the helper', () => {
    const block = policyBlock(norm(m5), 'messages_select_participant')
    expect(block).toContain(
      'using (public.is_conversation_participant(messages.conversation_id))',
    )
    expect(block).not.toContain('from public.conversation_participants')
  })

  it('recreates messages_insert_participant with auth.uid()-derived sender + helper', () => {
    const block = policyBlock(norm(m5), 'messages_insert_participant')
    expect(block).toContain(
      'sender_id = (select id from public.profiles where auth_user_id = auth.uid())',
    )
    expect(block).toContain('public.is_conversation_participant(messages.conversation_id)')
    expect(block).not.toContain('from public.conversation_participants')
  })

  it('drops each replaced policy before recreating it', () => {
    const sql = norm(m5)
    for (const name of [
      'conversations_select_participant',
      'participants_select_participant',
      'messages_select_participant',
      'messages_insert_participant',
    ]) {
      expect(sql).toContain(`drop policy if exists ${name}`)
    }
  })

  it('keeps RLS enabled on every user-sensitive table (nothing made public)', () => {
    // 0002 still carries the enable statements and 0005 must not disable them
    const sql = norm(m5)
    expect(sql).not.toContain('disable row level security')
    expect(sql).not.toContain('alter table public.') // 0005 alters no tables
    expect(sql).not.toContain('grant all on table')
    expect(sql).not.toContain('to anon')
  })

  it('keeps the user_secrets INSERT repair grant (BUG 2 secondary path)', () => {
    const sql = norm(m5)
    expect(sql).toContain('grant insert on table public.user_secrets to authenticated')
    expect(sql).not.toContain('grant select on table public.user_secrets')
    expect(sql).not.toContain('grant update on table public.user_secrets')
    expect(sql).not.toContain('grant delete on table public.user_secrets')
  })
})

describe('regression: final (migration 0005) policies never re-introduce recursion', () => {
  // 0005 drops and recreates the four participant-dependent policies. The
  // operative definitions must never embed an inline subquery against an
  // RLS-enabled table, otherwise PostgreSQL re-applies RLS inside the policy
  // and recursion returns (HTTP 500).
  it('the recreated select policies contain no conversation_participants subquery', () => {
    const sql = norm(m5)
    for (const name of [
      'conversations_select_participant',
      'participants_select_participant',
      'messages_select_participant',
    ]) {
      const block = policyBlock(sql, name)
      expect(block).not.toContain('from public.conversation_participants')
      expect(block).not.toContain('from public.profiles')
    }
  })

  it('the recreated insert policy contains no conversation_participants subquery', () => {
    const block = policyBlock(norm(m5), 'messages_insert_participant')
    expect(block).not.toContain('from public.conversation_participants')
  })

  it('0002’s original recursive policies are dropped by 0005 (no duplicate live policy)', () => {
    const sql = norm(m5)
    for (const name of [
      'conversations_select_participant',
      'participants_select_participant',
      'messages_select_participant',
      'messages_insert_participant',
    ]) {
      expect(sql).toContain(`drop policy if exists ${name}`)
    }
  })
})
