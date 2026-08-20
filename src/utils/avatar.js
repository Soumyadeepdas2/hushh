// ---------------------------------------------------------------------------
// Fixed avatar gallery.
//
// Users pick one of 12 bundled avatars (public/avatars/avatar-01.png … 12).
// Only the avatar_id (1..12 or null) is stored on profiles.avatar_id — no
// uploads, no storage, no backend. avatar_id is a PUBLIC field (like chat_id).
// ---------------------------------------------------------------------------

export const AVATAR_COUNT = 12

/** Is this a valid avatar id for the gallery? */
export function isValidAvatarId(id) {
  return Number.isInteger(id) && id >= 1 && id <= AVATAR_COUNT
}

/**
 * Resolve an avatar_id to its public asset path, or null when unset/invalid
 * (callers fall back to the initials avatar).
 */
export function avatarPath(avatarId) {
  const id = Number(avatarId)
  if (!isValidAvatarId(id)) return null
  return `/avatars/avatar-${String(id).padStart(2, '0')}.png`
}
