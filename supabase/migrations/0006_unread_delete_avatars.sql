

alter table public.conversation_participants
  add column if not exists last_read_at timestamptz not null default now();

alter table public.profiles
  add column if not exists avatar_id smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_id_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_id_check
      check (avatar_id is null or (avatar_id between 1 and 12));
  end if;
end $$;

create or replace function public.get_unread_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select m.conversation_id, count(*)::bigint as unread_count
  from public.messages m
  join public.conversation_participants cp on cp.conversation_id = m.conversation_id
  join public.profiles me on me.id = cp.user_id and me.auth_user_id = auth.uid()
  where m.sender_id <> cp.user_id
    and m.deleted_at is null
    and m.created_at > cp.last_read_at
  group by m.conversation_id
  having count(*) > 0;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversation_participants cp
  set last_read_at = now()
  from public.profiles me
  where cp.conversation_id = p_conversation_id
    and cp.user_id = me.id
    and me.auth_user_id = auth.uid();
$$;

create or replace function public.list_my_conversations()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, last_message_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.created_at, c.updated_at, c.last_message_at
  from public.conversations c
  join public.conversation_participants cp on cp.conversation_id = c.id
  join public.profiles me on me.id = cp.user_id
  where me.auth_user_id = auth.uid()
  order by c.last_message_at desc nulls last;
$$;

create or replace function public.delete_conversation_for_me(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid;
begin
  select id into v_me from public.profiles where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'unauthenticated';
  end if;

  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not_a_participant';
  end if;

  delete from public.conversation_participants
   where conversation_id = p_conversation_id and user_id = v_me;

  delete from public.conversations c
   where c.id = p_conversation_id
     and not exists (
       select 1 from public.conversation_participants cp
       where cp.conversation_id = c.id
     );
end;
$$;

create or replace function public.set_avatar(p_avatar_id smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_avatar_id is null or p_avatar_id < 1 or p_avatar_id > 12 then
    raise exception 'invalid_avatar';
  end if;
  update public.profiles
     set avatar_id = p_avatar_id
   where auth_user_id = auth.uid();
end;
$$;

drop function if exists public.get_profile_brief(uuid[]);
create or replace function public.get_profile_brief(p_ids uuid[])
returns table (id uuid, display_name text, chat_id text, avatar_id smallint)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.display_name, p.chat_id, p.avatar_id
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

drop function if exists public.search_profiles(text);
create or replace function public.search_profiles(p_query text)
returns table (id uuid, display_name text, chat_id text, avatar_id smallint)
language plpgsql
security definer
set search_path = public
stable
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
    select p.id, p.display_name, p.chat_id, p.avatar_id
    from public.profiles p
    where p.chat_id_normalized like q || '%' escape '\'
    order by (p.chat_id_normalized = q) desc, p.chat_id_normalized asc
    limit 20;
end;
$$;

revoke all on function public.get_unread_counts() from public, anon;
grant execute on function public.get_unread_counts() to authenticated;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

revoke all on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;

revoke all on function public.delete_conversation_for_me(uuid) from public, anon;
grant execute on function public.delete_conversation_for_me(uuid) to authenticated;

revoke all on function public.set_avatar(smallint) from public, anon;
grant execute on function public.set_avatar(smallint) to authenticated;

revoke all on function public.get_profile_brief(uuid[]) from public, anon;
grant execute on function public.get_profile_brief(uuid[]) to authenticated;

revoke all on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
