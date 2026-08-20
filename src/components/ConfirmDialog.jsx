import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// In-app confirmation modal — replaces window.confirm() for destructive
// actions (delete chat, delete message). Matches the Hushh design system.
// Closes on Cancel / Escape / outside click.
// ---------------------------------------------------------------------------

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

  // focus the confirm button on open; close on Escape / outside click
  useEffect(() => {
    if (!open) return undefined
    confirmRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
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
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
            autoFocus={false}
          >
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
