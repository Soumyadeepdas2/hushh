// ---------------------------------------------------------------------------
// Conversation service.
//
// Conversation creation goes through the security-definer RPC
// get_or_create_conversation(), which atomically creates the conversation and
// both participant rows. Clients can never directly write to
// conversation_participants, so a user cannot add themselves to a conversation
// they are not part of.
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase'
import { normalizeConversationResult } from '../utils/conversation'

/**
 * Get (or atomically create) a 1:1 conversation with another profile.
 * Returns { conversation_id, participant_ids }.
 *
 * PostgREST returns the RPC's TABLE(...) result as an array, so the response
 * is normalized to a single row here (see normalizeConversationResult).
 */
export async function getOrCreateConversation(otherProfileId) {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_other_profile: otherProfileId,
  })
  if (error) {
    throw new Error('Something went wrong. Please try again.')
  }
  return normalizeConversationResult(data) || {}
}

/**
 * List conversations visible to the caller (RLS: participant only, via the
 * security-definer RPC which also excludes nothing else — the caller's own
 * participant row defines visibility). Most recently active first.
 */
export async function listConversations() {
  const { data, error } = await supabase.rpc('list_my_conversations')
  if (error) throw new Error('Something went wrong. Please try again.')
  return data || []
}

/**
 * Unread message counts per conversation (participant-scoped; excludes the
 * caller's own messages and soft-deleted ones). Returns an array of
 * { conversation_id, unread_count } for conversations with count > 0.
 */
export async function getUnreadCounts() {
  const { data, error } = await supabase.rpc('get_unread_counts')
  if (error) return []
  return data || []
}

/** Advance the caller's read cursor for a conversation (clears its badge). */
export async function markConversationRead(conversationId) {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })
  if (error) throw new Error('Something went wrong. Please try again.')
}

/**
 * Delete a conversation FOR the caller: removes their participant row (and
 * the whole conversation + messages when no participants remain). The other
 * participant's copy is untouched.
 */
export async function deleteConversationForMe(conversationId) {
  const { error } = await supabase.rpc('delete_conversation_for_me', {
    p_conversation_id: conversationId,
  })
  if (error) throw new Error('Could not delete that conversation.')
}

/**
 * Participant rows for the given conversations (RLS: caller must be a
 * participant of each conversation).
 */
export async function listConversationParticipants(conversationIds) {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) return []
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds)
  if (error) return []
  return data || []
}

/**
 * Latest message preview per conversation (used by the sidebar).
 * Batched approximation: reads the most recent messages across the
 * conversations and keeps the newest one per conversation.
 */
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
