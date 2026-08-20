import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../hooks/useAuth'
import { useRecovery } from '../hooks/useRecovery'
import { Field, Button, ErrorBanner } from '../components/ui'
import { SECURITY_QUESTIONS } from '../data/securityQuestions'
import { signUpWithChatId } from '../services/auth'
import { createProfile, checkChatIdAvailable } from '../services/profiles'
import { createUserSecrets } from '../services/secrets'
import { generateRecoveryId, normalizeRecoveryId } from '../utils/recoveryId'
import { generateSaltHex, pbkdf2Hex, sha256Hex } from '../utils/hash'
import { normalizeSecurityAnswer } from '../utils/securityAnswer'
import { normalizeChatId, isValidChatId, generateChatId } from '../utils/chatId'
import { validateRegistration } from '../utils/validation'
import CaptchaWidget from '../components/CaptchaWidget'
import { isCaptchaEnabled, resetCaptcha } from '../lib/captcha'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Registration.
//
// Fields: display name, Chat ID, password, confirm password, security
// question, security answer. A Recovery ID is generated automatically — the
// user never chooses it and it is shown exactly once, after registration.
//
// Security properties:
//   - the login password goes straight to Supabase Auth; hushh never stores
//     or hashes it
//   - the security answer is normalized and stored only as a PBKDF2 hash
//     with a unique random salt
//   - the Recovery ID is stored only as a SHA-256 hash
//   - the plaintext Recovery ID lives in component state only, is shown once,
//     and is dropped after acknowledgement
// ---------------------------------------------------------------------------

const initialForm = {
  displayName: '',
  chatId: '',
  password: '',
  confirmPassword: '',
  securityQuestionId: 1,
  securityAnswer: '',
}

export default function Register() {
  // The one-time Recovery ID dialog is rendered by RecoveryProvider at the
  // App level so the post-signup /chat redirect cannot destroy it (BUG 2).
  const { show: showRecovery } = useRecovery()
  // refreshProfile re-fetches the profile AFTER the insert (see submit below)
  // so the auth listener's earlier, pre-insert fetch is superseded — this
  // prevents the "profile could not be loaded" screen behind the dialog.
  const { refreshProfile } = useAuth()

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [availability, setAvailability] = useState(null) // true | false | null
  // CAPTCHA (bot protection) — only active when VITE_CAPTCHA_SITE_KEY is set.
  // The shared CaptchaWidget mounts the hCaptcha widget and forwards tokens.
  const [captchaToken, setCaptchaToken] = useState(null)
  const [captchaError, setCaptchaError] = useState(false)

  const setField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (field === 'chatId') setAvailability(null)
  }

  const handleGenerateChatId = () => {
    const generated = generateChatId()
    setForm((prev) => ({ ...prev, chatId: generated }))
    setAvailability(null)
  }

  // Debounced availability check — UX only. The database is authoritative.
  useEffect(() => {
    const normalized = normalizeChatId(form.chatId)
    if (!isValidChatId(normalized)) {
      setAvailability(null)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const available = await checkChatIdAvailable(normalized)
      if (!cancelled) setAvailability(available)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.chatId])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()

      const validationErrors = validateRegistration(form)
      setErrors(validationErrors)
      if (Object.keys(validationErrors).length > 0) return

      // CAPTCHA gate: when a site key is configured, a completed widget token
      // is required before creating the account.
      if (isCaptchaEnabled() && !captchaToken) {
        setCaptchaError(true)
        return
      }

      setBusy(true)
      setError(null)

      // The plaintext Recovery ID exists only in this local scope while we
      // derive its hash. It is never sent anywhere.
      const recoveryId = generateRecoveryId()
      const chatIdNormalized = normalizeChatId(form.chatId)

      try {
        // 1. Create the Supabase Auth user (email = deterministic internal
        //    mapping of the Chat ID; password handled by Supabase Auth).
        //    The CAPTCHA token is forwarded for server-side verification.
        const { user } = await signUpWithChatId({
          chatId: chatIdNormalized,
          password: form.password,
          captchaToken,
        })

        // 2. Create the public profile row (RLS: only own row).
        await createProfile({
          authUserId: user.id,
          displayName: form.displayName.trim(),
          chatId: form.chatId.trim(),
          chatIdNormalized,
        })

        // 2b. RACE FIX: the auth listener fired SIGNED_IN during signUp() and
        //     fetched the profile BEFORE the insert above committed, so it may
        //     have stored `profile = null`. Re-fetch now, after the commit, so
        //     the chat screen behind the Recovery dialog has the real profile.
        if (user?.id) await refreshProfile(user.id)

        // 3. Derive and store ONLY the hashes in user_secrets.
        const answerSalt = await generateSaltHex()
        const [answerHash, recoveryHash] = await Promise.all([
          pbkdf2Hex(normalizeSecurityAnswer(form.securityAnswer), answerSalt),
          sha256Hex(normalizeRecoveryId(recoveryId)),
        ])
        await createUserSecrets({
          authUserId: user.id,
          recoveryIdHash: recoveryHash,
          securityQuestionId: Number(form.securityQuestionId),
          securityAnswerHash: answerHash,
          securityAnswerSalt: answerSalt,
        })

        // 4. Show the one-time recovery dialog (rendered by RecoveryProvider
        //    at App level — survives the GuestOnly /chat redirect).
        showRecovery(chatIdNormalized, recoveryId)
      } catch (err) {
        setError(err.message)
        // CAPTCHA tokens are single-use: reset the widget and require a fresh
        // one on the next attempt.
        setCaptchaToken(null)
        resetCaptcha()
        // If the Auth user was created but a later step failed, drop the local
        // session so the half-created account cannot be used from this browser.
        if (err.message !== 'That Chat ID is already taken.') {
          await supabase.auth.signOut()
        }
      } finally {
        setBusy(false)
      }
    },
    [form, refreshProfile, showRecovery, captchaToken],
  )

  return (
    <div className="auth-wrap">
      <header className="topbar auth-topbar">
        <Link to="/" className="topbar__brand auth-head__logo" aria-label="hushh home">
          <Logo size="sm" />
        </Link>
        <div className="topbar__actions">
          <Link to="/login" className="btn btn--ghost btn--small">
            Sign in
          </Link>
        </div>
      </header>

      <div className="auth-wrap__body">
        <div className="auth-card auth-card--wide">
          <div className="auth-head">
            <p className="auth-kicker">
              <span className="auth-kicker__dot" /> join hushh
            </p>
            <h1>Create your hushh</h1>
            <p className="auth-head__sub">
              No email address needed — just a Chat ID. You&apos;ll get a secret
              Recovery ID at the end.
            </p>
          </div>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Display name" htmlFor="reg-name" error={errors.displayName}>
            <input
              id="reg-name"
              className="input"
              type="text"
              autoComplete="name"
              placeholder="How should people see you?"
              value={form.displayName}
              onChange={setField('displayName')}
            />
          </Field>

          <Field
            label="Chat ID"
            htmlFor="reg-chatid"
            error={errors.chatId || (availability === false ? 'That Chat ID is already taken.' : undefined)}
            hint={availability === true ? 'This Chat ID is available.' : undefined}
          >
            <div className="input-row">
              <span className="input-row__prefix">@</span>
              <input
                id="reg-chatid"
                className="input"
                type="text"
                autoComplete="off"
                placeholder="soumyadeep"
                value={form.chatId}
                onChange={setField('chatId')}
              />
              <button
                type="button"
                className="btn btn--small"
                onClick={handleGenerateChatId}
                title="Generate a random Chat ID"
              >
                Generate ID
              </button>
            </div>
          </Field>

          <div className="field-row">
            <Field label="Password" htmlFor="reg-password" error={errors.password}>
              <input
                id="reg-password"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="8+ chars, letter & number"
                value={form.password}
                onChange={setField('password')}
              />
            </Field>

            <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirmPassword}>
              <input
                id="reg-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="Type it again"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
              />
            </Field>
          </div>

          <Field label="Security question" htmlFor="reg-question" error={errors.securityQuestion}>
            <select
              id="reg-question"
              className="input select"
              value={form.securityQuestionId}
              onChange={setField('securityQuestionId')}
            >
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Security answer"
            htmlFor="reg-answer"
            error={errors.securityAnswer}
            hint="Stored only as a secure hash — never in plaintext."
          >
            <input
              id="reg-answer"
              className="input"
              type="text"
              autoComplete="off"
              placeholder="Your answer"
              value={form.securityAnswer}
              onChange={setField('securityAnswer')}
            />
          </Field>

          <CaptchaWidget
            onToken={(token) => {
              setCaptchaToken(token)
              if (token) setCaptchaError(false)
            }}
            error={captchaError}
          />

          <Button type="submit" variant="accent" className="btn--block" disabled={busy}>
            {busy ? 'Creating your hushh…' : 'Create your hushh'}
          </Button>
        </form>

        <p className="auth-switch">
          Already have one? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
