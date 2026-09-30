

revoke all on table public.profiles from anon;
revoke all on table public.conversations from anon;
revoke all on table public.conversation_participants from anon;
revoke all on table public.messages from anon;

revoke all on table public.user_secrets from anon, authenticated;
grant insert on table public.user_secrets to authenticated;
revoke all on table public.recovery_attempts from anon, authenticated;

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

drop trigger if exists messages_prevent_edit on public.messages;
create trigger messages_prevent_edit
  before update on public.messages
  for each row execute function public.prevent_message_edit();

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

revoke all on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_recovery_attempt(text, timestamptz, integer, integer, integer, timestamptz)
  to service_role;
