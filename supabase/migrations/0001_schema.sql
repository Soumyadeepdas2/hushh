-- ============================================================================
-- hushh — migration 0001: schema
-- ----------------------------------------------------------------------------
-- Run these files against your CLOUD Supabase project in order:
--   Dashboard → SQL Editor → New query → paste → Run
-- (No local PostgreSQL is required anywhere in this project.)
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles — public directory data. Private fields live in user_secrets.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users (id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 1 and 50),
  chat_id            text not null check (char_length(chat_id) between 3 and 20),
  chat_id_normalized text not null, -- lowercase, trimmed (see src/utils/chatId.js)
  created_at         timestamptz not null default now()
);

-- Chat ID uniqueness is enforced at the DATABASE level, not just in the UI.
-- Two users can never claim the same normalized Chat ID, even concurrently.
create unique index if not exists profiles_chat_id_normalized_key
  on public.profiles (chat_id_normalized);

-- Prefix search support (search by Chat ID).
create index if not exists profiles_chat_id_prefix_idx
  on public.profiles (chat_id_normalized text_pattern_ops);

-- ---------------------------------------------------------------------------
-- user_secrets — NEVER readable by the browser. Only the service-role-backed
-- recover-password Edge Function touches this table.
--   recovery_id_hash          : sha256(normalizedRecoveryId)
--   security_question_id      : id from the fixed question list (1..6)
--   security_answer_hash      : PBKDF2-HMAC-SHA256(password, salt, 210000)
--   security_answer_salt      : unique random salt per user
-- No plaintext Recovery IDs, answers, passwords, hashes-of-answers are here.
-- ---------------------------------------------------------------------------
create table if not exists public.user_secrets (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid not null unique references auth.users (id) on delete cascade,
  recovery_id_hash      text not null,
  security_question_id  smallint not null check (security_question_id between 1 and 6),
  security_answer_hash  text not null,
  security_answer_salt  text not null,
  created_at            timestamptz not null default now()
);

create unique index if not exists user_secrets_recovery_id_hash_key
  on public.user_secrets (recovery_id_hash);

-- ---------------------------------------------------------------------------
-- conversations — 1:1 private conversations.
-- dedupe_key = least(participantA, participantB)::text || ':' || greatest(...)
-- The UNIQUE constraint on dedupe_key makes duplicate 1:1 conversations
-- impossible even under concurrency.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  dedupe_key      text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last);

-- ---------------------------------------------------------------------------
-- conversation_participants — who is in which conversation.
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

-- ---------------------------------------------------------------------------
-- messages — text-only in v1.
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz -- soft delete: set, never the body removed
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- recovery_attempts — server-side rate limiting for password recovery.
-- Only ever touched by the recover-password Edge Function (service role).
-- ---------------------------------------------------------------------------
create table if not exists public.recovery_attempts (
  identifier    text primary key, -- sha256 of the attempted Recovery ID
  attempt_count integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);
