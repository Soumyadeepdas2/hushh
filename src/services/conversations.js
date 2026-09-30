

import { supabase } from '../lib/supabase'
import { normalizeConversationResult } from '../utils/conversation'

export async function getOrCreateConversation(otherProfileId) {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_other_profile: otherProfileId,
  })
  if (error) {
    throw new Error('Something went wrong. Please try again.')
  }
  return normalizeConversationResult(data) || {}
}

export async function listConversations() {
  const { data, error } = await supabase.rpc('list_my_conversations')
  if (error) throw new Error('Something went wrong. Please try again.')
  return data || []
}

export async function getUnreadCounts() {
  const { data, error } = await supabase.rpc('get_unread_counts')
  if (error) return []
  return data || []
}

export async function markConversationRead(conversationId) {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) throw new Error('Something went wrong. Please try again.')
}

export async function deleteConversationForMe(conversationId) {
  const { error } = await supabase.rpc('delete_conversation_for_me', {
    p_conversation_id: conversationId,
  })
  if (error) throw new Error('Could not delete that conversation.')
}

export async function listConversationParticipants(conversationIds) {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) return []
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds)
  if (error) return []
  return data || []
}

export async function listLastMessages(conversationIds) {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, body, created_at, deleted_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return new Map()
  const latest = new Map()
  for (const message of data || []) {
    if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message)
  }
  return latest
}
