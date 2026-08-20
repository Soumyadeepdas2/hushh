// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { RecoveryProvider, useRecovery } from '../src/hooks/useRecovery'

// ---------------------------------------------------------------------------
// BUG 2 regression tests — one-time Recovery ID dialog.
//
// Root cause: the dialog previously lived inside Register's own JSX. On
// successful signup the GuestOnly wrapper in App.jsx redirects to /chat the
// moment a session exists, Register unmounts, and the local `recovery` state
// was destroyed before the dialog could render.
//
// Fix under test: RecoveryProvider renders the dialog at App level (above the
// router), so it survives the redirect.
//
// Security invariants pinned here:
//   - the plaintext Recovery ID is shown exactly once
//   - it is dropped from state on acknowledge (never persisted)
//   - no localStorage / sessionStorage / cookies are used
//   - only the hash is stored server-side (createUserSecrets)
// ---------------------------------------------------------------------------

const VALID_RECOVERY_ID = 'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-K2RT'
const CHAT_ID = 'soumyadeep'

const root = process.cwd() // vitest runs from the project root
const read = (p) => readFileSync(resolve(root, p), 'utf8')

function Harness() {
  const { show } = useRecovery()
  return (
    <button type="button" id="show" onClick={() => show(CHAT_ID, VALID_RECOVERY_ID)}>
      show recovery
    </button>
  )
}

let container
let reactRoot

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  reactRoot = createRoot(container)
})

afterEach(() => {
  act(() => reactRoot.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('RecoveryProvider renders the one-time RecoveryDialog (BUG 2)', () => {
  it('no dialog before show() is called', async () => {
    await act(async () => {
      reactRoot.render(
        <RecoveryProvider>
          <Harness />
        </RecoveryProvider>,
      )
    })
    expect(document.querySelector('.dialog')).toBeNull()
  })

  it('renders the dialog with Chat ID + Recovery ID after show()', async () => {
    await act(async () => {
      reactRoot.render(
        <RecoveryProvider>
          <Harness />
        </RecoveryProvider>,
      )
    })
    await act(async () => {
      document.getElementById('show').click()
    })

    const dialog = document.querySelector('.dialog')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain(`@${CHAT_ID}`)
    expect(dialog.textContent).toContain(VALID_RECOVERY_ID)
  })

  it('dismisses and drops the plaintext Recovery ID on acknowledge (shown once)', async () => {
    await act(async () => {
      reactRoot.render(
        <RecoveryProvider>
          <Harness />
        </RecoveryProvider>,
      )
    })
    await act(async () => {
      document.getElementById('show').click()
    })

    const dialog = document.querySelector('.dialog')
    // copy first (unlocks the acknowledge button), then acknowledge
    await act(async () => {
      dialog.querySelector('button.btn').click() // "Copy Recovery ID"
    })
    await act(async () => {
      dialog.querySelector('button.btn--primary').click() // "I've saved it"
    })

    expect(document.querySelector('.dialog')).toBeNull()
    // the plaintext Recovery ID is no longer anywhere in the DOM/state
    expect(document.body.textContent).not.toContain(VALID_RECOVERY_ID)
  })

  it('enforces copying before acknowledge — the dialog cannot be closed without a copy attempt', async () => {
    await act(async () => {
      reactRoot.render(
        <RecoveryProvider>
          <Harness />
        </RecoveryProvider>,
      )
    })
    await act(async () => {
      document.getElementById('show').click()
    })

    const dialog = document.querySelector('.dialog')
    const buttons = () => [...dialog.querySelectorAll('button')]
    const copyBtn = buttons().find((b) => b.textContent.includes('Copy Recovery ID'))
    const savedBtn = buttons().find((b) => b.textContent.includes("I've saved it"))

    // acknowledge is disabled until the user has copied
    expect(savedBtn.disabled).toBe(true)

    // a direct click on the disabled button does nothing — dialog stays open
    await act(async () => {
      savedBtn.click()
    })
    expect(document.querySelector('.dialog')).not.toBeNull()
    expect(document.body.textContent).toContain(VALID_RECOVERY_ID)

    // after a copy attempt the button unlocks
    await act(async () => {
      copyBtn.click()
    })
    expect(savedBtn.disabled).toBe(false)

    // closing now drops the plaintext Recovery ID from state
    await act(async () => {
      savedBtn.click()
    })
    expect(document.querySelector('.dialog')).toBeNull()
    expect(document.body.textContent).not.toContain(VALID_RECOVERY_ID)
  })
})

describe('registration recovery flow — static security pins (BUG 2)', () => {
  it('Register.jsx calls the provider (useRecovery) and no longer renders the dialog locally', () => {
    const register = read('src/pages/Register.jsx')
    expect(register).toContain("import { useRecovery } from '../hooks/useRecovery'")
    expect(register).toContain('showRecovery(chatIdNormalized, recoveryId)')
    expect(register).not.toContain('RecoveryDialog')
    expect(register).not.toContain('setRecovery(')
    expect(register).not.toContain('localStorage')
    expect(register).not.toContain('sessionStorage')
  })

  it('App.jsx mounts RecoveryProvider above the router', () => {
    const app = read('src/App.jsx')
    expect(app).toContain("import { RecoveryProvider } from './hooks/useRecovery'")
    // the provider wraps the router so the GuestOnly redirect cannot unmount it
    const providerIdx = app.indexOf('<RecoveryProvider>')
    const routerIdx = app.indexOf('<BrowserRouter>')
    expect(providerIdx).toBeGreaterThan(-1)
    expect(routerIdx).toBeGreaterThan(providerIdx)
  })

  it('useRecovery.jsx renders the dialog only from React state, never storage', () => {
    const hook = read('src/hooks/useRecovery.jsx')
    expect(hook).toContain('<RecoveryDialog')
    // no actual storage/history API usage (documentation comments may mention
    // the terms, so assert on property-access patterns only)
    expect(hook).not.toMatch(/localStorage\./)
    expect(hook).not.toMatch(/sessionStorage\./)
    expect(hook).not.toMatch(/document\.cookie/)
    expect(hook).not.toMatch(/history\./)
  })

  it('createUserSecrets stores ONLY hashed/salted recovery material, never plaintext', () => {
    const secrets = read('src/services/secrets.js')
    expect(secrets).toContain('recovery_id_hash: recoveryIdHash')
    expect(secrets).toContain('security_answer_hash: securityAnswerHash')
    expect(secrets).toContain('security_answer_salt: securityAnswerSalt')
    // the insert payload never contains a bare `recovery_id` column or a
    // bare `security_answer` value (only the *_hash / *_salt variants)
    expect(secrets).not.toMatch(/\brecovery_id\b/)
    expect(secrets).not.toMatch(/security_answer(?![_a-z])/)
    expect(secrets).toContain('SHA-256') // documented hash rationale
  })

  it('the registration flow generates a CSPRNG Recovery ID and derives its hash', () => {
    const register = read('src/pages/Register.jsx')
    expect(register).toContain("import { generateRecoveryId, normalizeRecoveryId } from '../utils/recoveryId'")
    expect(register).toContain('const recoveryId = generateRecoveryId()')
    expect(register).toContain('sha256Hex(normalizeRecoveryId(recoveryId))')
    expect(register).not.toContain('localStorage')
    expect(register).not.toContain('sessionStorage')
  })
})

describe('profile race fix (the "logged out" screen behind the dialog)', () => {
  it('Register re-fetches the profile AFTER the insert commits', () => {
    const register = read('src/pages/Register.jsx')
    expect(register).toContain("import { useAuth } from '../hooks/useAuth'")
    const createIdx = register.indexOf('await createProfile(')
    const refreshIdx = register.indexOf('await refreshProfile(user.id)')
    expect(createIdx).toBeGreaterThan(-1)
    expect(refreshIdx).toBeGreaterThan(createIdx)
  })

  it('Chat auto-retries the profile fetch and offers a Retry button', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('refreshProfile')
    expect(chat).toContain('handleRetryProfile')
    expect(chat).toContain('Retry')
    expect(chat).toContain('Log out')
    expect(chat).not.toContain('localStorage')
    expect(chat).not.toContain('sessionStorage')
  })
})
