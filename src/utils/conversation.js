// ---------------------------------------------------------------------------
// One-to-one conversation key logic.
//
// A 1:1 conversation is identified by a deterministic key built from the two
// participant profile IDs, sorted so the key is order-independent:
//
//     key = least(a, b) + ":" + greatest(a, b)
//
// The same key is computed inside the get_or_create_conversation() database
// function (security definer) and enforced by a UNIQUE constraint on
// conversations.dedupe_key, which makes duplicate 1:1 conversations
// impossible even under concurrency.
// ---------------------------------------------------------------------------

export function getConversationKey(profileIdA, profileIdB) {
  if (!profileIdA || !profileIdB) return null
  const a = String(profileIdA)
  const b = String(profileIdB)
  if (a === b) return null
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/**
 * Normalize the result of the get_or_create_conversation RPC.
 *
 * PostgREST returns the TABLE(...) result of an RPC as an ARRAY of rows
 * (application/vnd.pgrst.array+json) unless .single() is chained. The raw
 * array would make `data.conversation_id` undefined, which broke the
 * "start a conversation from search" flow ("Could not load messages.").
 * This helper accepts either shape and returns a single row (or null).
 *
 * @param {Array|object|null} data
 * @returns {{ conversation_id?: string, participant_ids?: string[] } | null}
 */
export function normalizeConversationResult(data) {
  if (!data) return null
  const row = Array.isArray(data) ? data[0] : data
  return row && typeof row === 'object' ? row : null
}
