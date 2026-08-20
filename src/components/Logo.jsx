import { useState } from 'react'

// ---------------------------------------------------------------------------
// hushh logo — the brand wordmark asset (public/logo.png).
// Falls back to the script-font wordmark if the image ever fails to load.
// ---------------------------------------------------------------------------

const SIZES = {
  sm: 'logo--sm',
  md: 'logo--md',
  lg: 'logo--lg',
}

export default function Logo({ size = 'md' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className={`logo ${SIZES[size] || SIZES.md}`} aria-label="hushh">
        hushh<span className="logo__dot">.</span>
      </span>
    )
  }

  return (
    <img
      src="/logo.png"
      alt="hushh"
      className={`logo-img ${SIZES[size] || SIZES.md}`}
      onError={() => setFailed(true)}
    />
  )
}
