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
 * List conversations visible to the caller (RLS: participant only),
 * most recently active first.
 */
export async function listConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, created_at, updated_at, last_message_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw new Error('Something went wrong. Please try again.')
  return data || []
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
