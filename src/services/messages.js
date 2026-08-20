// ---------------------------------------------------------------------------
// Message service. Text-only in v1 (no file/image/video upload).
//
// RLS guarantees:
//   - a user can only read messages of conversations they participate in
//   - a user can only INSERT messages as themselves, into conversations they
//     participate in
//   - a user can only UPDATE (soft-delete) their own messages, and only while
//     the message is not already deleted
//   - body edits are rejected by a database trigger
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase'
import { validateMessageBody } from '../utils/messages'

export async function sendMessage({ conversationId, senderId, body }) {
  const validationError = validateMessageBody(body)
  if (validationError) throw new Error(validationError)

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: body.trim(),
  })
  if (error) throw new Error('Something went wrong. Please try again.')
}

/**
 * Fetch message history for a conversation (RLS: participant only).
 * Returns messages in chronological order.
 */
export async function fetchMessages(conversationId, { before, limit = 100 } = {}) {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, deleted_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) throw new Error('Something went wrong. Please try again.')
  return (data || []).reverse()
}

/**
 * Soft-delete one of the caller's own messages.
 */
export async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw new Error('Something went wrong. Please try again.')
}
