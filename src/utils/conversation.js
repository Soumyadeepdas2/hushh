

export function getConversationKey(profileIdA, profileIdB) {
  if (!profileIdA || !profileIdB) return null
  const a = String(profileIdA)
  const b = String(profileIdB)
  if (a === b) return null
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export function normalizeConversationResult(data) {
  if (!data) return null
  const row = Array.isArray(data) ? data[0] : data
  return row && typeof row === 'object' ? row : null
}
