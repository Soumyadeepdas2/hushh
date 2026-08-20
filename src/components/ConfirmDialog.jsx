import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// In-app confirmation modal — replaces window.confirm() for destructive
// actions (delete chat, delete message). Matches the Hushh design system.
// Closes on Cancel / Escape / outside click.
//
// NOTE: outside-click is IGNORED for a short window after opening. On touch
// devices the browser fires a synthesized mousedown right after touchend,
// which would land on the just-rendered backdrop and close the dialog the
// instant it appears. The guard prevents that flash-close.
// ---------------------------------------------------------------------------

const OUTSIDE_IGNORE_MS = 350

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)
  const openAtRef = useRef(0)

  // focus the confirm button on open; close on Escape; guard outside-clicks
  useEffect(() => {
    if (!open) return undefined
    openAtRef.current = Date.now()
    confirmRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const handleBackdropMouseDown = (e) => {
    if (e.target !== e.currentTarget) return
    // ignore clicks that arrive within the guard window after opening
    if (Date.now() - openAtRef.current < OUTSIDE_IGNORE_MS) return
    onCancel()
  }

  return (
    <div className="dialog-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <p className="dialog__kicker">Are you sure?</p>
        <h2 className="dialog__title" id="confirm-title">
          {title}
        </h2>
        {message && (
          <p className="dialog__note" id="confirm-desc">
            {message}
          </p>
        )}
        <div className="dialog__actions confirm-dialog__actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className="btn btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
