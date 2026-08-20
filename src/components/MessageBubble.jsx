import { useEffect, useRef, useState } from 'react'

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const DOUBLE_TAP_MS = 300

/**
 * Pure double-tap detector (testable): a second tap within the threshold
 * after the first registers as a double tap.
 */
export function isDoubleTap(prevTimestamp, now, threshold = DOUBLE_TAP_MS) {
  if (!prevTimestamp) return false
  return now - prevTimestamp <= threshold
}

// ---------------------------------------------------------------------------
// A single message bubble. Deleted messages render as an italic placeholder —
// the body is never shown again after deletion.
//
// Deleting YOUR OWN message (not-yet-deleted) is gesture-driven:
//   • desktop  — RIGHT-CLICK the message → small "Delete message" menu
//   • touch    — DOUBLE-TAP the message → delete (with confirm in the parent)
// ---------------------------------------------------------------------------

export default function MessageBubble({ message, own, onDelete }) {
  const [menu, setMenu] = useState(null) // { x, y } cursor position
  const lastTapRef = useRef(0)
  const tapTimerRef = useRef(null)

  const canDelete = Boolean(own && !message.deleted_at && onDelete)

  const closeMenu = () => setMenu(null)

  // close the context menu on outside click / Escape / scroll
  useEffect(() => {
    if (!menu) return undefined
    const onDown = (e) => {
      if (!e.target.closest('.msg-menu')) closeMenu()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    const onScroll = () => closeMenu()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [menu])

  const requestDelete = () => {
    closeMenu()
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    lastTapRef.current = 0
    if (canDelete) onDelete(message)
  }

  const handleContextMenu = (e) => {
    if (!canDelete) return
    // on coarse pointers (phone/tablet) long-press shows the native menu —
    // double-tap is the touch gesture instead
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return
    e.preventDefault()
    const pad = 8
    const w = 180
    const h = 46
    const x = Math.min(e.clientX, window.innerWidth - w - pad)
    const y = Math.min(e.clientY, window.innerHeight - h - pad)
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }

  const handleTouchEnd = () => {
    if (!canDelete) return
    const now = Date.now()
    if (isDoubleTap(lastTapRef.current, now)) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      lastTapRef.current = 0
      requestDelete()
    } else {
      lastTapRef.current = now
      tapTimerRef.current = setTimeout(() => {
        lastTapRef.current = 0
      }, DOUBLE_TAP_MS + 80)
    }
  }

  if (message.deleted_at) {
    return (
      <div className={`msg msg--deleted ${own ? 'msg--own' : 'msg--other'}`}>
        <span className="msg__deleted-text">This message was deleted.</span>
        <span className="msg__time">{formatTime(message.created_at)}</span>
      </div>
    )
  }

  return (
    <>
      <div
        className={`msg ${own ? 'msg--own' : 'msg--other'}`}
        onContextMenu={canDelete ? handleContextMenu : undefined}
        onTouchEnd={canDelete ? handleTouchEnd : undefined}
      >
        <span className="msg__body">{message.body}</span>
        <span className="msg__time">{formatTime(message.created_at)}</span>
      </div>

      {menu && canDelete && (
        <div
          className="msg-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="msg-menu__item msg-menu__item--danger"
            role="menuitem"
            onClick={requestDelete}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
            Delete message
          </button>
        </div>
      )}
    </>
  )
}
