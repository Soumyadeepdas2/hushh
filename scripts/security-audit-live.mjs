#!/usr/bin/env node
// ============================================================================
// hushh — LIVE security penetration matrix (optional)
// ----------------------------------------------------------------------------
// Proves the RLS / Realtime / rate-limiting guarantees against a REAL
// Supabase project (PostgREST + Realtime), exactly as an attacker would:
// direct REST calls, not the UI.
//
// Requirements:
//   • A DEDICATED TEST Supabase project with migrations 0001–0005 applied,
//     Auth "Confirm email" DISABLED, and the recover-password Edge Function
//     deployed via the Dashboard with JWT verification disabled (the
//     Dashboard "Enforce JWT verification" toggle OFF).
//   • Environment variables (reuse the same .env as the app):
//       VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//
// Run:
//   npm run test:security
//
// Notes:
//   • Test users A/B/C are created with deterministic random Chat IDs; they
//     remain in the TEST project afterwards (clients cannot delete Auth
//     users without the service-role key, which this script never touches).
//   • Never run against a production project — it creates real users.
// ============================================================================

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ---- config ----------------------------------------------------------------

function loadEnv() {
  const env = {}
  if (existsSync(new URL('../.env', import.meta.url))) {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  }
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  return { url, anon }
}

const { url, anon } = loadEnv()
if (!url || !anon || url.includes('placeholder') || anon.includes('placeholder')) {
  console.log(
    'SKIP: live security audit requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY ' +
      'pointing at a dedicated TEST Supabase project.\n' +
      'Set them in .env and run again. (The static policy tests already ran in `npm test`.)',
  )
  process.exit(0)
}

// ---- helpers ---------------------------------------------------------------

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function expectReject(name, fn) {
  try {
    await fn()
    check(name, false, 'expected an error but the call succeeded')
  } catch {
    check(name, true)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (n) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)))
  .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
const randomChatId = (tag) => `audit-${tag}-${rand(6).toLowerCase()}`
const randomRecoveryId = () => `RC-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`
const domain = new URL(url).hostname
const chatIdToEmail = (id) => `${id}@${domain}`

const anonClient = createClient(url, anon)

async function createTestUser(tag) {
  const chatId = randomChatId(tag)
  const email = chatIdToEmail(chatId)
  const password = 'AuditPass2024!'
  const { data, error } = await anonClient.auth.signUp({ email, password })
  if (error || !data.session) {
    throw new Error(`could not create user ${tag}: ${error?.message || 'no session (Confirm email must be OFF)'}`)
  }
  const user = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } })
  user.auth.setSession(data.session)
  const { error: profileError } = await user.from('profiles').insert({
    auth_user_id: data.user.id,
    display_name: `Audit ${tag}`,
    chat_id: chatId,
    chat_id_normalized: chatId,
  })
  if (profileError) throw new Error(`profile insert for ${tag}: ${profileError.message}`)
  const { data: profile } = await user.from('profiles').select('id').eq('auth_user_id', data.user.id).single()
  return { tag, chatId, email, password, user, userId: data.user.id, profileId: profile.id }
}

// ---- main ------------------------------------------------------------------

console.log('\nhushh live security audit —', url, '\n')

const results = []
try {
  // ============ setup ============
  const [A, B, C] = await Promise.all([
    createTestUser('a'),
    createTestUser('b'),
    createTestUser('c'),
  ])

  // give A a secrets row so we can prove C cannot read it
  const { error: secretsError } = await A.user.from('user_secrets').insert({
    auth_user_id: A.userId,
    recovery_id_hash: 'a'.repeat(64),
    security_question_id: 1,
    security_answer_hash: 'b'.repeat(64),
    security_answer_salt: 'c'.repeat(32),
  })
  if (secretsError) throw new Error(`secrets insert for A: ${secretsError.message}`)

  // A ↔ B conversation via the security-definer RPC
  const { data: conv, error: convError } = await A.user.rpc('get_or_create_conversation', {
    p_other_profile: B.profileId,
  })
  if (convError) throw new Error(`get_or_create_conversation: ${convError.message}`)
  const conversationId = conv.conversation_id

  // A sends a message into A↔B
  const { error: sendError } = await A.user.from('messages').insert({
    conversation_id: conversationId,
    sender_id: A.profileId,
    body: 'hello from A',
  })
  if (sendError) throw new Error(`A send: ${sendError.message}`)

  // ============ RLS: conversation access (item 6) ============
  console.log('\n— RLS: conversation access (A ↔ B, C is an outsider)')
  {
    const { data: aSee } = await A.user.from('conversations').select('id').eq('id', conversationId)
    check('A can read the A↔B conversation', aSee.length === 1)
    const { data: bSee } = await B.user.from('conversations').select('id').eq('id', conversationId)
    check('B can read the A↔B conversation', bSee.length === 1)
    const { data: cSee } = await C.user.from('conversations').select('id').eq('id', conversationId)
    check('C cannot read the A↔B conversation', (cSee || []).length === 0)
    const { data: cList } = await C.user.from('conversations').select('id')
    check('C cannot enumerate conversations it is not in', (cList || []).length === 0)
  }

  // ============ RLS: messages (item 6) ============
  console.log('\n— RLS: messages')
  {
    const { data: aMsgs } = await A.user.from('messages').select('body').eq('conversation_id', conversationId)
    check('A can read A↔B messages', aMsgs.length === 1 && aMsgs[0].body === 'hello from A')
    const { data: bMsgs } = await B.user.from('messages').select('body').eq('conversation_id', conversationId)
    check('B can read A↔B messages', bMsgs.length === 1)
    const { data: cMsgs } = await C.user.from('messages').select('body').eq('conversation_id', conversationId)
    check('C cannot read A↔B messages', (cMsgs || []).length === 0)

    await expectReject('C cannot insert a message into A↔B', async () => {
      await C.user.from('messages').insert({
        conversation_id: conversationId,
        sender_id: C.profileId,
        body: 'intruder',
      })
    })

    await expectReject('A cannot spoof sender_id as B', async () => {
      await A.user.from('messages').insert({
        conversation_id: conversationId,
        sender_id: B.profileId,
        body: 'forged',
      })
    })

    const { data: bMsg } = await B.user.from('messages').select('id').limit(1).single()
    await expectReject('A cannot modify B’s message', async () => {
      await A.user.from('messages').update({ body: 'tampered' }).eq('id', bMsg.id)
    })
    await expectReject('B cannot delete A’s message (only own messages)', async () => {
      await B.user.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', aMsgs[0].id)
    })

    const { error: aDeleteErr } = await A.user
      .from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', aMsgs[0].id)
    check('A can soft-delete its own message', !aDeleteErr)
    await expectReject('A cannot modify an already-deleted message (undelete)', async () => {
      await A.user.from('messages').update({ deleted_at: null }).eq('id', aMsgs[0].id)
    })
  }

  // ============ RLS: secrets + profiles (items 1, 3, 9) ============
  console.log('\n— RLS: secrets, profiles, search')
  {
    const { data: cSecrets } = await C.user.from('user_secrets').select('*')
    check('C cannot read A’s user_secrets (0 rows)', (cSecrets || []).length === 0)
    const { data: aSecrets } = await A.user.from('user_secrets').select('*')
    check('A cannot read its own secrets either (RLS insert-only + revoke)', (aSecrets || []).length === 0)

    const { data: cProbe } = await C.user.from('profiles').select('*')
    check('C only ever sees its own profile row', (cProbe || []).length === 1 && cProbe[0].auth_user_id === C.userId)

    const { data: search } = await A.user.rpc('search_profiles', { p_query: B.chatId })
    check(
      'search returns only public fields (no email / auth id / recovery data)',
      search.length >= 1 &&
        Object.keys(search[0]).sort().join(',') === 'chat_id,display_name,id',
    )

    const { data: brief } = await A.user.rpc('get_profile_brief', { p_ids: [C.profileId] })
    check('get_profile_brief does not resolve profiles outside shared conversations', brief.length === 0)
  }

  // ============ duplicate + case-insensitive Chat IDs (items 1, 7) ============
  console.log('\n— Chat ID uniqueness (case-insensitive, database-enforced)')
  {
    const dupChatId = randomChatId('dup')
    await expectReject('second user cannot claim the same Chat ID (case variant)', async () => {
      const email = chatIdToEmail(dupChatId.toUpperCase()) // same normalized email
      const { data, error } = await anonClient.auth.signUp({ email, password: 'AuditPass2024!' })
      if (error || !data.session) throw new Error('blocked by Auth unique email')
      const dup = createClient(url, anon)
      dup.auth.setSession(data.session)
      await dup.from('profiles').insert({
        auth_user_id: data.user.id,
        display_name: 'Duplicate',
        chat_id: dupChatId.toUpperCase(),
        chat_id_normalized: dupChatId.toUpperCase(),
      })
    })
  }

  // ============ rate limiting via the deployed Edge Function (item 5) ============
  console.log('\n— recovery rate limiting (deployed recover-password Edge Function)')
  {
    const fnUrl = `${url}/functions/v1/recover-password`
    const call = async (body) => {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anon },
        body: JSON.stringify(body),
      })
      let json = {}
      try { json = await res.json() } catch { /* noop */ }
      return { status: res.status, ...json }
    }

    const rid = randomRecoveryId()
    const attempts = Array.from({ length: 12 }, () =>
      call({ action: 'reset', recoveryId: rid, securityAnswer: 'wrong-answer', newPassword: 'NewPass2024!' }),
    )
    await Promise.all(attempts)
    const after = await call({ action: 'reset', recoveryId: rid, securityAnswer: 'wrong-answer', newPassword: 'NewPass2024!' })
    check(
      '5 failed attempts within 15 min locks recovery (12 concurrent + 1 follow-up)',
      after.locked === true || /too many attempts/i.test(after.error || ''),
      JSON.stringify(after),
    )
    const lookup = await call({ action: 'lookup', recoveryId: rid })
    check('locked state also blocks the lookup step', lookup.locked === true || /too many attempts/i.test(lookup.error || ''))
  }

  // ============ Realtime authorization (item 7) ============
  console.log('\n— Realtime authorization')
  {
    const receivedByB = []
    const receivedByC = []

    const bChannel = B.user
      .channel(`audit-msgs-b-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) => receivedByB.push(p))
      .subscribe()
    const cChannel = C.user
      .channel(`audit-msgs-c-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) => receivedByC.push(p))
      .subscribe()

    await sleep(2500) // let subscriptions establish

    await A.user.from('messages').insert({
      conversation_id: conversationId,
      sender_id: A.profileId,
      body: 'realtime ping',
    })

    await sleep(4000) // give events time to arrive (and NOT arrive for C)

    check('authorized participant (B) receives the new message via Realtime', receivedByB.length >= 1)
    check('unauthorized user (C) receives nothing via Realtime', receivedByC.length === 0)

    B.user.removeChannel(bChannel)
    C.user.removeChannel(cChannel)
  }

  console.log('\n— done (test users remain in this TEST project; remove manually if desired)')
} catch (err) {
  failed += 1
  failures.push(`harness error: ${err.message}`)
  console.log(`\n  ✗ harness error: ${err.message}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
process.exit(0)
