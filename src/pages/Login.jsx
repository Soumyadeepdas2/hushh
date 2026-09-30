import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import CaptchaWidget from '../components/CaptchaWidget'
import { Field, Button, ErrorBanner } from '../components/ui'
import { signInWithChatId } from '../services/auth'
import { isCaptchaEnabled, resetCaptcha } from '../lib/captcha'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/chat'

  const [chatId, setChatId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [captchaError, setCaptchaError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (isCaptchaEnabled() && !captchaToken) {
      setCaptchaError(true)
      return
    }

    setBusy(true)
    try {
      await signInWithChatId(chatId, password, captchaToken)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)

      setCaptchaToken(null)
      resetCaptcha()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <header className="topbar auth-topbar">
        <Link to="/" className="topbar__brand auth-head__logo" aria-label="hushh home">
          <Logo size="sm" />
        </Link>
        <div className="topbar__actions">
          <Link to="/register" className="btn btn--accent btn--small">
            Create your hushh
          </Link>
        </div>
      </header>

      <div className="auth-wrap__body">
        <div className="auth-card">
          <div className="auth-head">
            <p className="auth-kicker">
              <span className="auth-kicker__dot" /> welcome back
            </p>
            <h1>Sign in quietly</h1>
            <p className="auth-head__sub">
              Your Chat ID and password are all you need — no email, no fuss.
            </p>
          </div>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit} noValidate>
            <Field label="Chat ID" htmlFor="login-chatid">
              <input
                id="login-chatid"
                className="input"
                type="text"
                autoComplete="username"
                placeholder="soumyadeep"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <CaptchaWidget
              onToken={(token) => {
                setCaptchaToken(token)
                if (token) setCaptchaError(false)
              }}
              error={captchaError}
            />

            <Button type="submit" variant="primary" className="btn--block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="auth-switch">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>
          <p className="auth-switch">
            New here? <Link to="/register">Create your hushh</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
