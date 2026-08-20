// ---------------------------------------------------------------------------
// CAPTCHA — bot protection for BOTH account creation and sign-in
// (hCaptcha via Supabase Auth).
//
// How it works:
//   • The PUBLIC site key lives in the frontend via VITE_CAPTCHA_SITE_KEY.
//   • The SECRET key is configured ONLY in the Supabase Dashboard:
//     Authentication → Security → Bot and Abuse Protection → CAPTCHA.
//     It never touches the frontend (this is Supabase Auth's server-side
//     verification — the client sends the widget token to signUp() /
//     signInWithPassword() and Supabase verifies it against the secret).
//   • When no site key is configured (local dev / preview / tests), the
//     widget is skipped and auth proceeds without CAPTCHA — the app must
//     stay runnable without extra credentials.
//
// Both the Register and Login forms use the same shared widget:
// src/components/CaptchaWidget.jsx — there is only ONE implementation.
// ---------------------------------------------------------------------------

export const CAPTCHA_SITE_KEY = (import.meta.env.VITE_CAPTCHA_SITE_KEY || '').trim()

/** Pure check: is CAPTCHA enabled for a given site key? */
export function captchaEnabledForKey(key) {
  return typeof key === 'string' && key.trim().length > 0
}

export function isCaptchaEnabled() {
  return captchaEnabledForKey(CAPTCHA_SITE_KEY)
}

/**
 * Build the Supabase Auth `options` object (pure, testable).
 * Used by BOTH signUp and signInWithPassword:
 *   { email, password, options: { captchaToken } }
 */
export function buildCaptchaAuthOptions(token) {
  if (!token) return undefined
  return { captchaToken: token }
}

let scriptPromise = null

/**
 * Inject the hCaptcha script once (render=explicit so we control when the
 * widget appears). Resolves true when hCaptcha is ready.
 */
export function loadCaptchaScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.hcaptcha) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=hushhCaptchaReady'
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(window.hcaptcha))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Render the widget into a container (DOM element or id string).
 * `onToken` receives the verification token (or null when the widget
 * resets/expires/fails).
 */
export function renderCaptcha(container, onToken) {
  if (typeof window === 'undefined' || !window.hcaptcha) return false
  window.hcaptcha.render(container, {
    sitekey: CAPTCHA_SITE_KEY,
    callback: (token) => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => onToken(null),
  })
  return true
}

/** Reset the widget (used after a failed submit so a fresh token is required). */
export function resetCaptcha() {
  if (typeof window !== 'undefined' && window.hcaptcha) {
    try {
      window.hcaptcha.reset()
    } catch {
      /* noop */
    }
  }
}
