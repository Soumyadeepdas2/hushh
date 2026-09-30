

export const CAPTCHA_SITE_KEY = (import.meta.env.VITE_CAPTCHA_SITE_KEY || '').trim()

export function captchaEnabledForKey(key) {
  return typeof key === 'string' && key.trim().length > 0
}

export function isCaptchaEnabled() {
  return captchaEnabledForKey(CAPTCHA_SITE_KEY)
}

export function buildCaptchaAuthOptions(token) {
  if (!token) return undefined
  return { captchaToken: token }
}

let scriptPromise = null

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

export function preloadCaptcha() {
  if (isCaptchaEnabled()) {
    loadCaptchaScript().catch(() => {})
  }
}

const renderedWidgetIds = []

export function renderCaptcha(container, onToken) {
  if (typeof window === 'undefined' || !window.hcaptcha) return false
  const widgetId = window.hcaptcha.render(container, {
    sitekey: CAPTCHA_SITE_KEY,
    callback: (token) => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => onToken(null),
  })
  if (typeof widgetId === 'number' && !renderedWidgetIds.includes(widgetId)) {
    renderedWidgetIds.push(widgetId)
  }
  return true
}

export function resetCaptcha() {
  if (typeof window === 'undefined' || !window.hcaptcha) return
  try {
    if (renderedWidgetIds.length > 0) {
      for (const id of renderedWidgetIds) window.hcaptcha.reset(id)
    } else {
      window.hcaptcha.reset()
    }
  } catch {

  }
}
