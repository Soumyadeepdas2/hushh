// ---------------------------------------------------------------------------
// Profile service.
//
// Public profile data (display name + Chat ID) is only ever read through
// security-definer RPCs (search_profiles / get_profile_brief / get_my_profile)
// so that private columns (auth_user_id, recovery hashes, salts) can never be
// fetched by the browser.
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase'

/**
 * Insert the caller's own profile row (registration). RLS permits inserting a
 * row only when auth_user_id equals the authenticated user's ID.
 */
export async function createProfile({ authUserId, displayName, chatId, chatIdNormalized }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: authUserId,
      display_name: displayName,
      chat_id: chatId,
      chat_id_normalized: chatIdNormalized,
    })
    .select('id, display_name, chat_id')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('That Chat ID is already taken.')
    }
    throw new Error('Something went wrong. Please try again.')
  }
  return data
}

/**
 * Best-effort availability check (UX only). The real uniqueness guarantee is
 * the UNIQUE constraint on profiles.chat_id_normalized and Supabase Auth's
 * unique internal email.
 */
export async function checkChatIdAvailable(chatIdNormalized) {
  const { data, error } = await supabase.rpc('chat_id_available', {
    p_chat_id: chatIdNormalized,
  })
  if (error) return true // fail open for UX; DB constraints are authoritative
  return data !== false
}

/**
 * Search users by Chat ID prefix. Returns only { id, display_name, chat_id }.
 * Never returns emails, auth user IDs or recovery information.
 */
export async function searchProfiles(query) {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query })
  if (error) return []
  return data || []
}

/**
 * Set the caller's avatar from the fixed gallery (1..12). Validated
 * server-side by the security-definer RPC.
 */
export async function setAvatar(avatarId) {
  const { error } = await supabase.rpc('set_avatar', { p_avatar_id: avatarId })
  if (error) {
    throw new Error('Something went wrong. Please try again.')
  }
}

/**
 * Fetch brief profile info for the participants of conversations the caller
 * belongs to. The RPC only returns rows for profiles sharing a conversation
 * with the caller, and now includes avatar_id (public field).
 */
export async function getProfileBrief(profileIds) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) return []
  const { data, error } = await supabase.rpc('get_profile_brief', { p_ids: profileIds })
  if (error) return []
  return data || []
}
