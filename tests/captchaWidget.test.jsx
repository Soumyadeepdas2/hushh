// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// Mock the captcha lib so the widget can be tested without a real script/network.
vi.mock('../src/lib/captcha', () => ({
  isCaptchaEnabled: vi.fn(() => true),
  loadCaptchaScript: vi.fn(() => Promise.resolve(true)),
  renderCaptcha: vi.fn(() => true),
  resetCaptcha: vi.fn(),
  CAPTCHA_SITE_KEY: '10000000-aaaa-bbbb-cccc-000000000001',
  captchaEnabledForKey: vi.fn(() => true),
}))

import CaptchaWidget from '../src/components/CaptchaWidget'
import { isCaptchaEnabled, loadCaptchaScript, renderCaptcha } from '../src/lib/captcha'

// ---------------------------------------------------------------------------
// Shared hCaptcha widget render tests (used by BOTH Register and Login).
// ---------------------------------------------------------------------------

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  isCaptchaEnabled.mockReturnValue(true)
  loadCaptchaScript.mockResolvedValue(true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

describe('CaptchaWidget (shared by Register + Login)', () => {
  it('renders the widget container and mounts hCaptcha once', async () => {
    const onToken = vi.fn()
    await act(async () => {
      root.render(<CaptchaWidget onToken={onToken} error={false} />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(renderCaptcha).toHaveBeenCalledTimes(1)
    const [el] = renderCaptcha.mock.calls[0]
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('captcha__widget')
  })

  it('forwards the verification token (and null on expiry) to the parent', async () => {
    const onToken = vi.fn()
    await act(async () => {
      root.render(<CaptchaWidget onToken={onToken} error={false} />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    const callback = renderCaptcha.mock.calls[0][1]
    await act(async () => callback('P1_token'))
    expect(onToken).toHaveBeenCalledWith('P1_token')

    // widget expired → onToken(null) so the parent can block submission again
    await act(async () => callback(null))
    expect(onToken).toHaveBeenCalledWith(null)
  })

  it('shows the "please complete" message when the parent reports an error (submit without token)', async () => {
    await act(async () => {
      root.render(<CaptchaWidget onToken={vi.fn()} error={true} />)
    })
    expect(document.querySelector('.captcha__error')).not.toBeNull()
    expect(document.querySelector('.captcha__error').textContent).toContain('CAPTCHA')
  })

  it('shows the message when the hCaptcha script fails to load', async () => {
    loadCaptchaScript.mockResolvedValue(false)
    await act(async () => {
      root.render(<CaptchaWidget onToken={vi.fn()} error={false} />)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(document.querySelector('.captcha__error')).not.toBeNull()
  })

  it('renders nothing when CAPTCHA is disabled (no site key configured)', async () => {
    isCaptchaEnabled.mockReturnValue(false)
    await act(async () => {
      root.render(<CaptchaWidget onToken={vi.fn()} error={false} />)
    })
    expect(document.querySelector('.captcha')).toBeNull()
    expect(renderCaptcha).not.toHaveBeenCalled()
  })
})
