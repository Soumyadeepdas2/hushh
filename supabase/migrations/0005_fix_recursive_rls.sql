

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

revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists conversations_select_participant on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  using (public.is_conversation_participant(conversations.id));

drop policy if exists participants_select_participant on public.conversation_participants;
create policy "participants_select_participant"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_participants.conversation_id));

drop policy if exists messages_select_participant on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  using (public.is_conversation_participant(messages.conversation_id));

drop policy if exists messages_insert_participant on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = (select id from public.profiles where auth_user_id = auth.uid())
    and public.is_conversation_participant(messages.conversation_id)
  );

grant insert on table public.user_secrets to authenticated;
