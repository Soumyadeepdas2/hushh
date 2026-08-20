import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { Field, Button, ErrorBanner } from '../components/ui'
import { SECURITY_QUESTIONS, securityQuestionById } from '../data/securityQuestions'
import { lookupRecoveryQuestion, resetPasswordWithRecovery } from '../services/recovery'
import { validatePassword } from '../utils/password'
import { validateRecoveryInput } from '../utils/recovery'

// ---------------------------------------------------------------------------
// Forgot Password.
//
// Flow:  Recovery ID  ->  associated security question  ->  answer  ->
//        new password  ->  done.
//
// The Chat ID is NEVER sufficient to initiate recovery. All verification and
// the actual password change happen inside the recover-password Edge
// Function (rate-limited, service-role based admin password update).
// ---------------------------------------------------------------------------

const STEPS = { recovery: 'recovery', answer: 'answer', password: 'password', done: 'done' }

export default function ForgotPassword() {
  const [step, setStep] = useState(STEPS.recovery)
  const [recoveryId, setRecoveryId] = useState('')
  const [questionId, setQuestionId] = useState(null)
  const [answer, setAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const resetAll = () => {
    setStep(STEPS.recovery)
    setRecoveryId('')
    setQuestionId(null)
    setAnswer('')
    setNewPassword('')
    setConfirmPassword('')
    setErrors({})
    setError(null)
  }

  const submitRecoveryId = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const data = await lookupRecoveryQuestion(recoveryId)
      setQuestionId(data.securityQuestionId)
      setStep(STEPS.answer)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = (e) => {
    e.preventDefault()
    if (!answer.trim()) {
      setErrors({ answer: 'Security answer is required.' })
      return
    }
    setErrors({})
    setError(null)
    setStep(STEPS.password)
  }

  const submitNewPassword = async (e) => {
    e.preventDefault()
    setError(null)
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      setErrors({ newPassword: passwordError })
      return
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' })
      return
    }
    const validationErrors = validateRecoveryInput({ recoveryId, securityAnswer: answer, newPassword })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await resetPasswordWithRecovery({ recoveryId, securityAnswer: answer, newPassword })
      setStep(STEPS.done)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const question = securityQuestionById(questionId)

  return (
    <div className="auth-wrap">
      <header className="topbar auth-topbar">
        <Link to="/" className="topbar__brand auth-head__logo" aria-label="hushh home">
          <Logo size="sm" />
        </Link>
        <div className="topbar__actions">
          <Link to="/login" className="btn btn--ghost btn--small">
            Back to sign in
          </Link>
        </div>
      </header>

      <div className="auth-wrap__body">
        <div className="auth-card">
          <div className="auth-head">
            <p className="auth-kicker">
              <span className="auth-kicker__dot" /> password recovery
            </p>
            <h1>Recover your password</h1>
            <p className="auth-head__sub">
              You&apos;ll need your <strong>Recovery ID</strong> and your security
              answer. Your Chat ID alone can&apos;t recover the account.
            </p>
          </div>

        <ErrorBanner message={error} />

        {step === STEPS.recovery && (
          <form onSubmit={submitRecoveryId} noValidate>
            <Field
              label="Recovery ID"
              htmlFor="fp-recovery"
              error={errors.recoveryId}
              hint="Found in the one-time dialog you saw when you created your hushh."
            >
              <input
                id="fp-recovery"
                className="input"
                type="text"
                autoComplete="off"
                placeholder="RC-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                value={recoveryId}
                onChange={(e) => setRecoveryId(e.target.value)}
                autoFocus
              />
            </Field>
            <Button type="submit" variant="primary" className="btn--block" disabled={busy}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          </form>
        )}

        {step === STEPS.answer && (
          <form onSubmit={submitAnswer} noValidate>
            <div className="recovery-question">
              <p className="recovery-question__label">Your security question</p>
              <p className="recovery-question__text">
                {question ? question.text : 'Security question'}
              </p>
            </div>
            <Field label="Security answer" htmlFor="fp-answer" error={errors.answer}>
              <input
                id="fp-answer"
                className="input"
                type="text"
                autoComplete="off"
                placeholder="Your answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                autoFocus
              />
            </Field>
            <Button type="submit" variant="primary" className="btn--block">
              Continue
            </Button>
            <button type="button" className="btn btn--ghost btn--block" onClick={resetAll}>
              Start over
            </button>
          </form>
        )}

        {step === STEPS.password && (
          <form onSubmit={submitNewPassword} noValidate>
            <Field label="New password" htmlFor="fp-password" error={errors.newPassword}>
              <input
                id="fp-password"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="8+ chars, letter & number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Confirm new password" htmlFor="fp-confirm" error={errors.confirmPassword}>
              <input
                id="fp-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="Type it again"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" className="btn--block" disabled={busy}>
              {busy ? 'Changing password…' : 'Change password'}
            </Button>
            <button type="button" className="btn btn--ghost btn--block" onClick={resetAll}>
              Start over
            </button>
          </form>
        )}

        {step === STEPS.done && (
          <div className="recovery-done">
            <p className="recovery-done__title">Password changed.</p>
            <p className="recovery-done__sub">
              You can now sign in with your Chat ID and your new password.
            </p>
            <Link to="/login" className="btn btn--primary btn--block">
              Sign in
            </Link>
          </div>
        )}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Sign in</Link>
        </p>
        </div>
      </div>
    </div>
  )
}
