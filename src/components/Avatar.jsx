import { avatarPath } from '../utils/avatar'

// ---------------------------------------------------------------------------
// Avatar — renders the user's chosen gallery avatar, falling back to
// initials (current behavior) when none is set.
// ---------------------------------------------------------------------------

function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

export default function Avatar({ profile, size = 'md', className = '', navy = false }) {
  const path = avatarPath(profile?.avatar_id)

  if (path) {
    return (
      <img
        src={path}
        alt=""
        className={`avatar avatar--img avatar--${size} ${className}`.trim()}
        aria-hidden="true"
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <span
      className={`avatar avatar--${size} ${navy ? 'avatar--navy' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      {initials(profile?.display_name)}
    </span>
  )
}
