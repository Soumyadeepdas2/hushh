

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users (id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 1 and 50),
  chat_id            text not null check (char_length(chat_id) between 3 and 20),
  chat_id_normalized text not null,
  created_at         timestamptz not null default now()
);

create unique index if not exists profiles_chat_id_normalized_key
  on public.profiles (chat_id_normalized);

create index if not exists profiles_chat_id_prefix_idx
  on public.profiles (chat_id_normalized text_pattern_ops);

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

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  dedupe_key      text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

create table if not exists public.recovery_attempts (
  identifier    text primary key,
  attempt_count integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);
