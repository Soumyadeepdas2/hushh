import { useEffect, useRef, useState } from 'react'
import { isCaptchaEnabled, loadCaptchaScript, renderCaptcha } from '../lib/captcha'

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
