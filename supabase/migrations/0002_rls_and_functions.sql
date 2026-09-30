

alter table public.profiles enable row level security;
alter table public.user_secrets enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.recovery_attempts enable row level security;

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

create policy "user_secrets_insert_own"
  on public.user_secrets for insert
  with check (auth.uid() = auth_user_id);

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

grant execute on function public.chat_id_available(text) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_profile_brief(uuid[]) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
