-- ============================================================================
-- hushh — migration 0004: security hardening
-- ----------------------------------------------------------------------------
-- Applies on top of 0001–0003 (additive + idempotent where possible).
-- Adds:
--   1. Explicit REVOKEs (defense in depth on top of RLS).
--   2. Database-level Chat ID charset constraints.
--   3. Profile identity immutability (Chat ID / normalized Chat ID / auth
--      user id can never change after registration).
--   4. Message sender forcing (sender_id derived from auth.uid(), never
--      trusted from the client) and a stricter edit guard.
--   5. Atomic server-side recovery rate limiting (race-safe upsert + purge).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. REVOKE (defense in depth — RLS remains the primary control)
-- ---------------------------------------------------------------------------

-- The anonymous role needs no table access at all (signup goes through the
-- Auth API, not PostgREST).
revoke all on table public.profiles from anon;
revoke all on table public.conversations from anon;
revoke all on table public.conversation_participants from anon;
revoke all on table public.messages from anon;

-- Secrets and rate-limit state are readable/writable ONLY by the service
-- role (the recover-password Edge Function). Even a misconfigured RLS
-- policy cannot expose them to client roles.
--
-- The authenticated role keeps exactly ONE table privilege on user_secrets:
-- INSERT, which the registration flow needs to write its own hashed secrets
-- row (RLS restricts it to the caller's own auth_user_id). SELECT / UPDATE /
-- DELETE remain impossible for every client role.
revoke all on table public.user_secrets from anon, authenticated;
grant insert on table public.user_secrets to authenticated;
revoke all on table public.recovery_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Chat ID charset constraints (server-side, in addition to UI validation)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_chat_id_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_chat_id_format_check
      check (chat_id ~ '^[A-Za-z0-9-]{3,20}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_chat_id_normalized_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_chat_id_normalized_format_check
      check (chat_id_normalized ~ '^[a-z0-9-]{3,20}$');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Profile identity immutability
--
-- The Supabase Auth email is derived from the Chat ID at registration. If a
-- user could change chat_id / chat_id_normalized afterwards, the stored Chat
-- ID would diverge from the Auth email and logins would break; it would also
-- let a user "re-claim" an identity. These columns (and auth_user_id) are
-- therefore immutable at the database level. Only display_name may change.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_prevent_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'auth_user_id is immutable';
  end if;
  if new.chat_id is distinct from old.chat_id then
    raise exception 'chat_id is immutable';
  end if;
  if new.chat_id_normalized is distinct from old.chat_id_normalized then
    raise exception 'chat_id_normalized is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_identity_immutable on public.profiles;
create trigger profiles_identity_immutable
  before update on public.profiles
  for each row execute function public.profiles_prevent_identity_change();

-- ---------------------------------------------------------------------------
-- 4. Message hardening
-- ---------------------------------------------------------------------------

-- a) Sender forcing: the client can never declare sender_id. The database
--    derives it from the authenticated user (auth.uid()), then verifies
--    membership in the target conversation. Defense in depth on top of the
--    RLS insert policy.
create or replace function public.messages_force_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
begin
  select id into v_sender from public.profiles where auth_user_id = auth.uid();
  if v_sender is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.user_id = v_sender
  ) then
    raise exception 'not a participant of this conversation';
  end if;
  new.sender_id := v_sender;
  return new;
end;
$$;

drop trigger if exists messages_force_sender_trigger on public.messages;
create trigger messages_force_sender_trigger
  before insert on public.messages
  for each row execute function public.messages_force_sender();

-- b) Stricter edit guard: messages may only ever be soft-deleted
--    (deleted_at := now()). Body, conversation, sender, created_at and
--    deleted_at cannot be changed or cleared.
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
  if new.sender_id is distinct from old.sender_id then
    raise exception 'sender_id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  if old.deleted_at is not null then
    raise exception 'deleted messages cannot be modified';
  end if;
  return new;
end;
$$;

-- Re-apply so the trigger uses the updated function.
drop trigger if exists messages_prevent_edit on public.messages;
create trigger messages_prevent_edit
  before update on public.messages
  for each row execute function public.prevent_message_edit();

-- ---------------------------------------------------------------------------
-- 5. Atomic server-side recovery rate limiting
--
-- Called ONLY by the recover-password Edge Function (service role). One
-- upsert statement computes the new attempt count and lock state under a row
-- lock on the identifier, so concurrent requests cannot read-then-write
-- their way past the limit. Also purges stale rows so the table stays
-- bounded under enumeration-style floods.
-- Semantics mirror supabase/functions/recover-password/rate-limit.ts:
--   5 failed attempts within 15 minutes → locked until now + 15 minutes.
-- ---------------------------------------------------------------------------
create index if not exists recovery_attempts_updated_at_idx
  on public.recovery_attempts (updated_at);

create or replace function public.record_recovery_attempt(
  p_identifier text,
  p_now timestamptz,
  p_window_ms integer,
  p_max_attempts integer,
  p_lock_ms integer,
  p_purge_before timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.recovery_attempts
   where updated_at < p_purge_before;

  insert into public.recovery_attempts (identifier, attempt_count, locked_until, updated_at)
  values (p_identifier, 1, null, p_now)
  on conflict (identifier) do update set
    attempt_count = case
      when public.recovery_attempts.updated_at >= p_now - make_interval(secs => (p_window_ms::double precision / 1000.0))
        then public.recovery_attempts.attempt_count + 1
      else 1
    end,
    locked_until = case
      when (
        case
          when public.recovery_attempts.updated_at >= p_now - make_interval(secs => (p_window_ms::double precision / 1000.0))
            then public.recovery_attempts.attempt_count + 1
          else 1
        end
      ) >= p_max_attempts
        then p_now + make_interval(secs => (p_lock_ms::double precision / 1000.0))
      else null
    end,
    updated_at = p_now;
$$;

-- Only the service role may call it (the Edge Function runs with the
-- service-role key). Client roles can neither read nor write the table.
revoke all on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz)
  to service_role;
