import { useEffect, useRef, useState } from 'react'

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const LONG_PRESS_MS = 550

export default function MessageBubble({ message, own, onDelete }) {
  const [menu, setMenu] = useState(null)
  const touchTimerRef = useRef(null)

  const canDelete = Boolean(own && !message.deleted_at && onDelete)

  const closeMenu = () => setMenu(null)

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

  useEffect(
    () => () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    },
    [],
  )

  const requestDelete = () => {
    closeMenu()
    if (canDelete) onDelete(message)
  }

  const handleContextMenu = (e) => {
    if (!canDelete) return

    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return
    e.preventDefault()
    const pad = 8
    const w = 180
    const h = 46
    const x = Math.min(e.clientX, window.innerWidth - w - pad)
    const y = Math.min(e.clientY, window.innerHeight - h - pad)
    setMenu({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }

  const handleTouchStart = (e) => {
    if (!canDelete) return

    if (e.touches && e.touches.length > 1) return
    clearTouchTimer()
    touchTimerRef.current = setTimeout(() => {
      touchTimerRef.current = null
      requestDelete()
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = () => {

    clearTouchTimer()
  }

  const handleTouchEnd = () => {

    clearTouchTimer()
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
        onTouchStart={canDelete ? handleTouchStart : undefined}
        onTouchMove={canDelete ? handleTouchMove : undefined}
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
