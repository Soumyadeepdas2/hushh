

export const AVATAR_COUNT = 12

export function isValidAvatarId(id) {
  return Number.isInteger(id) && id >= 1 && id <= AVATAR_COUNT
}

export function avatarPath(avatarId) {
  const id = Number(avatarId)
  if (!isValidAvatarId(id)) return null
  return `/avatars/avatar-${String(id).padStart(2, '0')}.png`
}
