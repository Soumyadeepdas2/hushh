-- ============================================================================
-- hushh — migration 0002: row level security, functions, triggers
-- ----------------------------------------------------------------------------
-- RLS is the security backbone of hushh. Every user-sensitive table is
-- protected; secrets are only reachable by the service role (Edge Function).
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.user_secrets enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.recovery_attempts enable row level security;

-- ============================================================================
-- profiles
--   SELECT: only your own row. Other users' rows are readable ONLY through
--           the security-definer functions below, which return just the
--           public fields (id, display_name, chat_id).
--   INSERT: only your own row (registration).
--   UPDATE: only your own row.
--   DELETE: only your own row (registration rollback).
-- ============================================================================
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = auth_user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = auth_user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = auth_user_id);

-- ============================================================================
-- user_secrets
--   INSERT: only your own row (registration).
--   SELECT/UPDATE/DELETE: NO policies → only the service role (the
--   recover-password Edge Function) can ever read recovery data.
-- ============================================================================
create policy "user_secrets_insert_own"
  on public.user_secrets for insert
  with check (auth.uid() = auth_user_id);

-- ============================================================================
-- conversations
--   SELECT: only participants.
--   INSERT/UPDATE/DELETE: NO client policies. Conversations and participants
--   are created exclusively by the security-definer function
--   get_or_create_conversation(). last_message_at / updated_at are
--   maintained by the security-definer trigger touch_conversation().
-- ============================================================================
create policy "conversations_select_participant"
  on public.conversations for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      join public.profiles me on me.id = cp.user_id
      where cp.conversation_id = conversations.id
        and me.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- conversation_participants
--   SELECT: only participants of the same conversation.
--   INSERT/UPDATE/DELETE: NO client policies (RPC-created only).
-- ============================================================================
create policy "participants_select_participant"
  on public.conversation_participants for select
  using (
    exists (
      select 1
      from public.conversation_participants mine
      join public.profiles me on me.id = mine.user_id
      where mine.conversation_id = conversation_participants.conversation_id
        and me.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- messages
--   SELECT: only participants of the conversation.
--   INSERT: only as yourself, into a conversation you participate in.
--   UPDATE: only your own, not-yet-deleted messages (soft delete).
--   Body edits are additionally blocked by trigger prevent_message_edit().
-- ============================================================================
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1
      from public.conversation_participants cp
      join public.profiles me on me.id = cp.user_id
      where cp.conversation_id = messages.conversation_id
        and me.auth_user_id = auth.uid()
    )
  );

create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = sender_id
    )
  );

create policy "messages_update_own"
  on public.messages for update
  using (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
    and deleted_at is null
  )
  with check (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
  );

-- recovery_attempts: intentionally NO policies. Client (and anon) roles can
-- neither read nor write it; only the service role can.

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Soft-delete only: block body edits and moving messages between
-- conversations. Runs as the invoking user, but merely raising on invalid
-- changes is safe regardless of privileges.
create or replace function public.prevent_message_edit()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    raise exception 'messages cannot be edited';
  end if;
  if new.conversation_id is distinct from old.conversation_id then
    raise exception 'messages cannot be moved between conversations';
  end if;
  return new;
end;
$$;

create trigger messages_prevent_edit
  before update on public.messages
  for each row execute function public.prevent_message_edit();

-- Keep conversations.updated_at / last_message_at fresh. Security definer so
-- the update succeeds even though clients have no UPDATE policy on
-- conversations.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversations_touch_after_message
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ============================================================================
-- SECURITY-DEFINER FUNCTIONS (the only way to read other users' profiles)
-- ============================================================================

-- Availability check (UX nicety; the DB constraints are authoritative).
create or replace function public.chat_id_available(p_chat_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where chat_id_normalized = lower(trim(p_chat_id))
  );
$$;

-- Search by Chat ID prefix. Returns ONLY public fields (id, display_name,
-- chat_id). Never emails, never auth user ids, never recovery data.
create or replace function public.search_profiles(p_query text)
returns table (id uuid, display_name text, chat_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  q text;
begin
  q := coalesce(lower(trim(p_query)), '');
  q := regexp_replace(q, '^@+', '');
  if length(q) < 1 then
    return;
  end if;
  -- escape LIKE wildcards so user input cannot act as a wildcard
  q := replace(q, '\', '\\');
  q := replace(q, '%', '\%');
  q := replace(q, '_', '\_');
  return query
    select p.id, p.display_name, p.chat_id
    from public.profiles p
    where p.chat_id_normalized like q || '%' escape '\'
    order by (p.chat_id_normalized = q) desc, p.chat_id_normalized asc
    limit 20;
end;
$$;

-- The caller's own profile (public fields).
create or replace function public.get_my_profile()
returns table (id uuid, display_name text, chat_id text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.chat_id
  from public.profiles p
  where p.auth_user_id = auth.uid();
$$;

-- Brief profile info for conversation participants. Only returns rows for
-- profiles that share a conversation with the caller, so arbitrary profile
-- IDs cannot be probed.
create or replace function public.get_profile_brief(p_ids uuid[])
returns table (id uuid, display_name text, chat_id text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.chat_id
  from public.profiles p
  where p.id = any(p_ids)
    and exists (
      select 1
      from public.conversation_participants a
      join public.conversation_participants b on b.conversation_id = a.conversation_id
      join public.profiles me on me.auth_user_id = auth.uid() and me.id = b.user_id
      where a.user_id = p.id
    );
$$;

-- Atomically create (or fetch) a 1:1 conversation and both participant rows.
-- Security definer: the client can never insert participant rows directly,
-- so a user cannot add themselves to a conversation they were not invited to.
create or replace function public.get_or_create_conversation(p_other_profile uuid)
returns table (conversation_id uuid, participant_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid;
  v_conv uuid;
  v_key  text;
begin
  select id into v_me from public.profiles where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'unauthenticated';
  end if;

  if p_other_profile is null or p_other_profile = v_me then
    raise exception 'invalid_peer';
  end if;

  if not exists (select 1 from public.profiles where id = p_other_profile) then
    raise exception 'peer_not_found';
  end if;

  -- deterministic, order-independent key (mirrors src/utils/conversation.js)
  v_key := least(v_me::text, p_other_profile::text) || ':' || greatest(v_me::text, p_other_profile::text);

  insert into public.conversations (dedupe_key)
  values (v_key)
  on conflict (dedupe_key) do nothing;

  select id into v_conv from public.conversations where dedupe_key = v_key;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv, v_me), (v_conv, p_other_profile)
  on conflict do nothing;

  return query select v_conv, array[v_me, p_other_profile];
end;
$$;

-- ============================================================================
-- GRANTS (execution is limited to authenticated users)
-- ============================================================================
grant execute on function public.chat_id_available(text) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_profile_brief(uuid[]) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
