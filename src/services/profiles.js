

import { supabase } from '../lib/supabase'

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

export async function checkChatIdAvailable(chatIdNormalized) {
  const { data, error } = await supabase.rpc('chat_id_available', {
    p_chat_id: chatIdNormalized,
  })
  if (error) return true
  return data !== false
}

export async function searchProfiles(query) {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query })
  if (error) return []
  return data || []
}

export async function setAvatar(avatarId) {
  const { error } = await supabase.rpc('set_avatar', { p_avatar_id: avatarId })
  if (error) {
    throw new Error('Something went wrong. Please try again.')
  }
}

export async function getProfileBrief(profileIds) {
  if (!Array.isArray(profileIds) || profileIds.length === 0) return []
  const { data, error } = await supabase.rpc('get_profile_brief', { p_ids: profileIds })
  if (error) return []
  return data || []
}
