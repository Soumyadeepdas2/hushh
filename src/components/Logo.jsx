import { useState } from 'react'

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
