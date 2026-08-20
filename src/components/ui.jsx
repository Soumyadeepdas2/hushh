// Small shared UI primitives used across pages.

export function Button({ variant = 'default', type = 'button', className = '', disabled, children, onClick }) {
  const classes = ['btn']
  if (variant === 'primary') classes.push('btn--primary')
  if (variant === 'accent') classes.push('btn--accent')
  if (variant === 'ghost') classes.push('btn--ghost')
  if (className) classes.push(className)
  return (
    <button type={type} className={classes.join(' ')} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  )
}
