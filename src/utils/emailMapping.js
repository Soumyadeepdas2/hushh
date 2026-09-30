

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
