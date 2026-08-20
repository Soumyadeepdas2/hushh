import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildCaptchaAuthOptions, captchaEnabledForKey } from '../src/lib/captcha'
import { toFriendlyAuthError } from '../src/services/auth'

// The auth service imports the Supabase client (which initializes Realtime
// WebSockets — not available in the Node 20 test env). Mock it so we can
// exercise the pure error-mapping function without a network/WebSocket.
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

// ---------------------------------------------------------------------------
// CAPTCHA (bot protection at account creation AND sign-in) tests.
//
// The widget itself is DOM + network dependent, so we test the pure decision
// logic and pin the wiring to the actual source files. The Supabase Auth
// secret key is NEVER in the frontend — only the public site key via env.
// ---------------------------------------------------------------------------

const root = process.cwd()
const read = (p) => readFileSync(resolve(root, p), 'utf8')

describe('captchaEnabledForKey (pure)', () => {
  it('is disabled when the site key is empty/whitespace/missing', () => {
    expect(captchaEnabledForKey('')).toBe(false)
    expect(captchaEnabledForKey('   ')).toBe(false)
    expect(captchaEnabledForKey(undefined)).toBe(false)
    expect(captchaEnabledForKey(null)).toBe(false)
  })

  it('is enabled when a site key is configured', () => {
    expect(captchaEnabledForKey('10000000-aaaa-bbbb-cccc-000000000001')).toBe(true)
  })
})

describe('buildCaptchaAuthOptions (pure)', () => {
  it('returns the captchaToken option only when a token exists', () => {
    expect(buildCaptchaAuthOptions('P1_eyJ0eXAi')).toEqual({ captchaToken: 'P1_eyJ0eXAi' })
    expect(buildCaptchaAuthOptions('')).toBeUndefined()
    expect(buildCaptchaAuthOptions(null)).toBeUndefined()
    expect(buildCaptchaAuthOptions(undefined)).toBeUndefined()
  })
})

describe('auth service forwards the token to Supabase Auth', () => {
  it('signUp options carry the captchaToken', () => {
    const auth = read('src/services/auth.js')
    expect(auth).toContain("import { buildCaptchaAuthOptions } from '../lib/captcha'")
    expect(auth).toContain('captchaOptions ? { email, password, options: captchaOptions }')
  })

  it('signInWithPassword options carry the captchaToken (login 400 fix)', () => {
    const auth = read('src/services/auth.js')
    expect(auth).toContain('export async function signInWithChatId(chatId, password, captchaToken)')
    expect(auth).toContain('const captchaOptions = buildCaptchaAuthOptions(captchaToken)')
    expect(auth).toContain('await supabase.auth.signInWithPassword(')
    expect(auth).toContain('captchaOptions ? { email, password, options: captchaOptions } : { email, password }')
  })

  it('maps CAPTCHA failures to a clear user message', () => {
    expect(toFriendlyAuthError({ message: 'captcha verification failed' })).toContain('CAPTCHA')
    expect(toFriendlyAuthError({ message: 'Invalid captcha token' })).toContain('CAPTCHA')
  })
})

describe('CAPTCHA wiring (static pins)', () => {
  it('a single shared CaptchaWidget component is used by BOTH forms', () => {
    expect(read('src/components/CaptchaWidget.jsx')).toContain(
      "import { isCaptchaEnabled, loadCaptchaScript, renderCaptcha } from '../lib/captcha'",
    )
    expect(read('src/pages/Register.jsx')).toContain(
      "import CaptchaWidget from '../components/CaptchaWidget'",
    )
    expect(read('src/pages/Login.jsx')).toContain(
      "import CaptchaWidget from '../components/CaptchaWidget'",
    )
  })

  it('Register gates submission on a completed CAPTCHA when enabled', () => {
    const register = read('src/pages/Register.jsx')
    expect(register).toContain("} from '../lib/captcha'")
    expect(register).toContain('isCaptchaEnabled() && !captchaToken')
    expect(register).toContain('captchaToken,')
    expect(register).toContain('resetCaptcha()')
    expect(register).toContain('<CaptchaWidget')
    // the message now lives in the shared component
    expect(read('src/components/CaptchaWidget.jsx')).toContain(
      'Please complete the CAPTCHA to continue.',
    )
  })

  it('Login gates submission on a completed CAPTCHA when enabled', () => {
    const login = read('src/pages/Login.jsx')
    expect(login).toContain("import { isCaptchaEnabled, resetCaptcha } from '../lib/captcha'")
    expect(login).toContain('isCaptchaEnabled() && !captchaToken')
    expect(login).toContain('signInWithChatId(chatId, password, captchaToken)')
    expect(login).toContain('setCaptchaToken(null)')
    expect(login).toContain('resetCaptcha()')
    expect(login).toContain('<CaptchaWidget')
    // the Login page still shows the standard form fields and button
    expect(login).toContain('Sign in quietly')
    expect(login).toContain('btn--block')
  })

  it('no CAPTCHA secret VALUES are ever embedded in the frontend', () => {
    // The hCaptcha SECRET is a UUID; a leaked one would appear as a UUID or
    // long hex/JWT literal. Comments may mention "secret key" — what must not
    // exist is an actual secret value hardcoded in source.
    const suspicious =
      /(0x[0-9a-fA-F]{20,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|eyJ[a-zA-Z0-9_-]{20,})/i
    const files = [
      'src/lib/captcha.js',
      'src/services/auth.js',
      'src/pages/Register.jsx',
      'src/pages/Login.jsx',
      'src/components/CaptchaWidget.jsx',
    ]
    for (const file of files) {
      expect(read(file), file).not.toMatch(suspicious)
    }
  })

  it('captcha site key comes only from the env var', () => {
    const captcha = read('src/lib/captcha.js')
    expect(captcha).toContain('VITE_CAPTCHA_SITE_KEY')
    // no hardcoded sitekey literal (site keys are UUIDs)
    expect(captcha).not.toMatch(/sitekey\s*[:=]\s*['"][0-9a-f-]{20,}/i)
  })
})
