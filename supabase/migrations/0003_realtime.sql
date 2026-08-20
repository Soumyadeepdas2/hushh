-- ============================================================================
-- hushh — migration 0003: Supabase Realtime
-- ----------------------------------------------------------------------------
-- Enables Postgres Changes on the messages and conversations tables so the
-- chat UI receives live events.
--
-- Security: Supabase Realtime enforces RLS — a client only receives events
-- for rows it is authorized to SELECT. Because messages/conversations only
-- expose rows to participants, realtime can never leak messages from
-- conversations a user is not part of.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
