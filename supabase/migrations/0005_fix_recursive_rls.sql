-- ============================================================================
-- hushh — migration 0005: fix recursive RLS (conversations HTTP 500) + repair
-- ----------------------------------------------------------------------------
-- ROOT CAUSE (BUG 1):
--   The policy "participants_select_participant" (migration 0002) placed a
--   subquery on public.conversation_participants INSIDE its own USING clause.
--   PostgreSQL applies RLS to subqueries inside policies, so evaluating the
--   policy re-evaluated itself:
--
--     ERROR: infinite recursion detected in policy for relation
--            "conversation_participants"
--
--   The policies on conversations and messages also subquery
--   conversation_participants, so they hit the same recursion. Every REST
--   read of conversations / participants / messages therefore failed with
--   HTTP 500.
--
-- FIX (minimal, security-preserving):
--   1. Add a hardened SECURITY DEFINER helper is_conversation_participant()
--      that answers "is the CURRENT user (auth.uid()) a participant of this
--      conversation?"  Security definer functions run with the owner's
--      privileges (RLS is not re-applied inside them), which breaks the
--      recursion. The helper:
--        - is SECURITY DEFINER with SET search_path = public
--        - derives the caller from auth.uid() — never from an argument
--        - returns ONLY a boolean (no row data, no ids, no hashes)
--        - is REVOKEd from public/anon and EXECUTE-granted to authenticated
--          only — anonymous users cannot call it, and it cannot be abused to
--          enumerate unrelated conversations (conversation ids are random
--          UUIDs and the helper answers true/false only)
--   2. Recreate the four participant-dependent policies to use the helper.
--      No policy expression queries an RLS-enabled table anymore.
--   3. Idempotent repair: re-grant INSERT on user_secrets to authenticated
--      (defense in depth for the registration recovery flow; harmless if the
--      grant already exists from migration 0004).
--
-- RLS stays ENABLED on every table. No table is made public. No existing
-- migration is modified.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Hardened SECURITY DEFINER membership helper
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    join public.profiles me on me.id = cp.user_id
    where cp.conversation_id = p_conversation_id
      and me.auth_user_id = auth.uid()
  );
$$;

-- Anonymous users can never call it; only authenticated users may.
revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recreate the recursive policies via the helper
-- ---------------------------------------------------------------------------

-- conversations: caller may SELECT a conversation only if they are a
-- participant. No subquery on an RLS table remains inside the policy.
drop policy if exists conversations_select_participant on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  using (public.is_conversation_participant(conversations.id));

-- conversation_participants: caller may SELECT a participant row only for
-- conversations they belong to.
drop policy if exists participants_select_participant on public.conversation_participants;
create policy "participants_select_participant"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_participants.conversation_id));

-- messages: caller may SELECT a message only if they are a participant of
-- the conversation.
drop policy if exists messages_select_participant on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  using (public.is_conversation_participant(messages.conversation_id));

-- messages: caller may INSERT a message only as themselves and into a
-- conversation they participate in. sender_id is still derived from
-- auth.uid() (RLS check + messages_force_sender trigger); the helper
-- replaces the inline conversation_participants subquery (equivalent, since
-- sender_id is forced to be the caller's own profile id).
drop policy if exists messages_insert_participant on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
    and public.is_conversation_participant(messages.conversation_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Idempotent repair grant (BUG 2 secondary path)
--    Registration inserts the caller's own hashed secrets row as the
--    authenticated user. If migration 0004 was applied before its
--    `grant insert` line existed, this restores the single INSERT privilege.
--    SELECT/UPDATE/DELETE on user_secrets remain impossible for clients.
-- ---------------------------------------------------------------------------
grant insert on table public.user_secrets to authenticated;
