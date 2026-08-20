import { useEffect, useRef, useState } from 'react'
import { isCaptchaEnabled, loadCaptchaScript, renderCaptcha } from '../lib/captcha'

// ---------------------------------------------------------------------------
// Reusable hCaptcha widget — used by BOTH the Register and Login forms.
//
// • mounts the widget exactly once into an element ref (no id collisions)
// • forwards the verification token (or null on expiry/failure) to `onToken`
// • shows the standard "Please complete the CAPTCHA" message when `error` is
//   true (parent sets it when the user submits without a token) or when the
//   hCaptcha script fails to load
//
// Resetting after a failed submit is the parent's job via resetCaptcha() from
// lib/captcha, so a fresh token is required on the next attempt.
// ---------------------------------------------------------------------------

export default function CaptchaWidget({ onToken, error }) {
  const mountRef = useRef(null)
  const renderedRef = useRef(false)
  const onTokenRef = useRef(onToken)
  const [internalError, setInternalError] = useState(false)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!isCaptchaEnabled()) return undefined

    let cancelled = false
    loadCaptchaScript().then((ok) => {
      if (cancelled) return
      if (!ok || !mountRef.current) {
        setInternalError(true)
        return
      }
      if (!renderedRef.current) {
        renderedRef.current = true
        renderCaptcha(mountRef.current, (token) => {
          onTokenRef.current(token)
          if (token) setInternalError(false)
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!isCaptchaEnabled()) return null

  const showError = Boolean(error || internalError)

  return (
    <div className="captcha">
      <div ref={mountRef} className="captcha__widget" />
      {showError && (
        <p className="field-error captcha__error">Please complete the CAPTCHA to continue.</p>
      )}
    </div>
  )
}
