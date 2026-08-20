import { useEffect, useRef, useState } from 'react'
import { AVATAR_COUNT, avatarPath } from '../utils/avatar'
import Avatar from './Avatar'

// ---------------------------------------------------------------------------
// Settings menu (replaces the Log out button in the chat sidebar header).
//   • shows the current profile (avatar + display name + Chat ID)
//   • "Choose avatar" — grid of the 12 bundled avatars (tap to select)
//   • Log out
// Closes on outside click / Escape. Selection calls back to the parent which
// persists via the set_avatar RPC and refreshes the profile.
// ---------------------------------------------------------------------------

export default function SettingsMenu({ profile, onSelectAvatar, onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handlePick = (id) => {
    setOpen(false)
    onSelectAvatar(id)
  }

  return (
    <div className="settings" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost btn--small settings__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="settings__menu" role="menu">
          <div className="settings__me">
            <Avatar profile={profile} size="md" navy={false} />
            <div className="settings__me-text">
              <span className="settings__me-name">{profile?.display_name}</span>
              <span className="settings__me-chatid">@{profile?.chat_id}</span>
            </div>
          </div>

          <div className="settings__section">
            <p className="settings__label">Choose your avatar</p>
            <div className="settings__avatars">
              {Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1).map((id) => {
                const path = avatarPath(id)
                const active = profile?.avatar_id === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`settings__avatar ${active ? 'settings__avatar--active' : ''}`}
                    onClick={() => handlePick(id)}
                    title={`Avatar ${id}`}
                    aria-pressed={active}
                  >
                    {path && <img src={path} alt={`Avatar ${id}`} />}
                  </button>
                )
              })}
            </div>
          </div>

          <button type="button" className="btn btn--ghost btn--block settings__logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
