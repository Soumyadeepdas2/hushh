import { useState } from 'react'

// ---------------------------------------------------------------------------
// One-time recovery dialog shown right after registration.
//
// The plaintext Recovery ID exists ONLY in this component's state (which is
// itself short-lived) — it is never written to localStorage, sessionStorage,
// cookies, the URL, analytics, the database or logs. Once the user
// acknowledges, the parent drops the value from state entirely.
//
// Copy enforcement: the "I've saved it" button stays DISABLED until the user
// clicks "Copy Recovery ID" at least once. This guarantees the user has made
// the copy attempt (which also triggers the clipboard/focus cycle that
// re-syncs the session and loads the profile in the background), and it
// prevents the "close without saving" scenario. If the clipboard is blocked,
// a hint appears and the button still unlocks after the copy attempt so the
// user is never trapped.
// ---------------------------------------------------------------------------

export default function RecoveryDialog({ chatId, recoveryId, onDone }) {
  const [copied, setCopied] = useState(false)
  const [copyTouched, setCopyTouched] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const handleCopy = async () => {
    setCopyTouched(true)
    try {
      await navigator.clipboard.writeText(recoveryId)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // clipboard unavailable — the user can still select the ID manually
      setCopyFailed(true)
      setCopied(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <p className="dialog__kicker">One-time recovery info</p>
        <h2 className="dialog__title" id="recovery-title">
          Your hushh has been created.
        </h2>

        <div className="recovery-row">
          <span>Chat ID</span>
          <strong>@{chatId}</strong>
        </div>
        <div className="recovery-row">
          <span>Recovery ID</span>
          <strong className="recovery-id">{recoveryId}</strong>
        </div>

        <p className="dialog__note">
          Save this Recovery ID somewhere safe. You will need it together with your security
          answer if you forget your password. <strong>It will not be shown again.</strong>
        </p>

        <div className="dialog__warn" role="note">
          <strong>Please copy it now.</strong> If you close this window without copying, the
          chat screen behind may briefly show a “retry” prompt — don&apos;t worry, your account
          was created successfully. Just press <strong>Retry</strong> and you&apos;ll be signed
          in. To avoid that, save the Recovery ID first.
        </div>

        {copyFailed && (
          <p className="dialog__copy-failed">
            Clipboard unavailable — select the Recovery ID above, copy it manually, then continue.
          </p>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn" onClick={handleCopy} disabled={copied}>
            {copied ? 'Copied ✓' : 'Copy Recovery ID'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onDone}
            disabled={!copyTouched}
            title={
              copyTouched
                ? undefined
                : 'Copy your Recovery ID first — it will never be shown again.'
            }
          >
            I&apos;ve saved it
          </button>
        </div>
        {!copyTouched && (
          <p className="dialog__hint">
            The “I&apos;ve saved it” button unlocks after you copy your Recovery ID.
          </p>
        )}
      </div>
    </div>
  )
}
