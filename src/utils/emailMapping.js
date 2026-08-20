// ---------------------------------------------------------------------------
// Deterministic internal email mapping.
//
// Supabase Auth authenticates with an email/password credential. hushh users
// do not have (and are never asked for) an email address — they only see
// Chat ID + password.
//
// We therefore derive a deterministic, internal-only email from the
// normalized Chat ID:
//
//     chatid:<normalized>@<project-hostname>
//
// Example:  "Soumyadeep" -> "soumyadeep@abcdefgh.supabase.co"
//
// This mapping is an IMPLEMENTATION DETAIL. It is:
//   - never displayed in the UI
//   - never searchable
//   - never stored as a public profile field
//   - never shown in error messages
//
// Because Supabase Auth enforces unique emails, this mapping also gives Chat
// IDs database-level uniqueness (a second layer on top of the UNIQUE
// constraint on profiles.chat_id_normalized).
// ---------------------------------------------------------------------------

import { normalizeChatId } from './chatId'

const FALLBACK_DOMAIN = 'hushh.local'

function projectDomain() {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) return FALLBACK_DOMAIN
  try {
    return new URL(url).hostname
  } catch {
    return FALLBACK_DOMAIN
  }
}

export function chatIdToEmail(chatId) {
  const normalized = normalizeChatId(chatId)
  return `${normalized}@${projectDomain()}`
}
