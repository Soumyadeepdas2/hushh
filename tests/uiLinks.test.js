import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// UI wiring pins: every hushh logo links home, the chat screen guards a
// missing conversation id, and the favicon is visible in light & dark mode.
// ---------------------------------------------------------------------------

const root = process.cwd()
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const has = (p) => existsSync(resolve(root, p))

describe('every hushh logo links to the home page', () => {
  it('auth pages wrap the top-bar logo in a Link to "/"', () => {
    for (const page of ['Login.jsx', 'Register.jsx', 'ForgotPassword.jsx']) {
      const source = read(`src/pages/${page}`)
      // logo sits in the shared top bar now (small size), still a home link
      expect(source, page).toContain(
        '<Link to="/" className="topbar__brand auth-head__logo" aria-label="hushh home">',
      )
      expect(source, page).toContain('<Logo size="sm" />')
      // the card body is wrapped for the centered layout
      expect(source, page).toContain('<div className="auth-wrap__body">')
    }
  })

  it('chat sidebar wraps the logo in a Link to "/"', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain("import { Link, useNavigate } from 'react-router-dom'")
    expect(chat).toContain('<Link to="/" className="chat-side__logo" aria-label="hushh home">')
  })

  it('landing nav + footer brand link to "/"', () => {
    const landing = read('src/pages/Landing.jsx')
    expect(landing).toContain('className="landing__brand"')
    expect(landing).toContain('<Link to="/" className="site-footer__logo" aria-label="hushh home">')
  })

  it('logo-link wrappers are styled without underlines', () => {
    const css = read('src/styles/global.css')
    expect(css).toContain('.auth-head__logo,')
    expect(css).toContain('.chat-side__logo,')
    expect(css).toContain('.site-footer__logo')
    expect(css).toContain('text-decoration: none')
  })
})

describe('chat screen guards a missing conversation id (no broken queries)', () => {
  it('openConversation returns early when the id is missing', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('if (!conversationId) return')
  })

  it('handleStartConversation validates the id before opening', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('const { conversation_id: conversationId } = await getOrCreateConversation(user.id)')
    expect(chat).toContain('if (!conversationId)')
    expect(chat).toContain("showToast('Could not start that conversation.')")
  })
})

describe('favicon is visible in light & dark mode', () => {
  it('index.html references /favicon.png (not the transparent logo)', () => {
    const html = read('index.html')
    expect(html).toContain('href="/favicon.png"')
    expect(html).not.toContain('href="/logo.png"')
  })

  it('the favicon file exists next to the unchanged logo', () => {
    expect(has('public/favicon.png')).toBe(true)
    expect(has('public/logo.png')).toBe(true) // logo asset preserved
  })
})

describe('shared top-bar header system', () => {
  it('defines a reusable .topbar used by auth pages and the landing nav', () => {
    const css = read('src/styles/global.css')
    expect(css).toContain('.topbar {')
    expect(css).toContain('.topbar__actions')
    // the brand-yellow accent strip is the shared header signature
    expect(css).toMatch(/inset 0 3px 0 0 var\(--yellow\)/)
    // all headers share ONE tall height so the logo is never clipped
    expect(css).toContain('--topbar-h: 112px;')
    expect(css).toMatch(/\.topbar \{[\s\S]*?height: var\(--topbar-h\)/)
    expect(css).toMatch(/\.landing__nav \{[\s\S]*?height: var\(--topbar-h\)/)
    expect(css).toMatch(/\.chat-side__header \{[\s\S]*?height: var\(--topbar-h\)/)
    expect(css).toMatch(/\.chat-main__header \{[\s\S]*?height: var\(--topbar-h\)/)
    // the top-bar logo is big yet sized to fit inside the header (never cut)
    expect(css).toMatch(/\.topbar__brand \.logo-img \{[\s\S]*?width: 200px/)
  })

  it('auth pages render a top bar above the card body', () => {
    for (const page of ['Login.jsx', 'Register.jsx', 'ForgotPassword.jsx']) {
      const source = read(`src/pages/${page}`)
      expect(source, page).toContain('<header className="topbar auth-topbar">')
      expect(source, page).toContain('<div className="topbar__actions">')
    }
  })

  it('chat message header shows the private tag', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('<span className="chat-main__tag">private</span>')
  })
})

describe('unread badge clears on open + hover bin removed (bug fixes)', () => {
  it('Chat passes onDelete only to the message bubble, not the conversation list', () => {
    const chat = read('src/pages/Chat.jsx')
    // the ConversationList element has no onDelete prop (hover bin removed)
    expect(chat).toContain(
      '<ConversationList\n            conversations={conversations}\n            activeId={activeId}\n            onOpen={openConversation}\n          />',
    )
    // message bubbles get the delete handler (right-click / double-tap) which
    // opens the in-app confirm modal
    expect(chat).toMatch(/<MessageBubble[\s\S]*?onDelete=\{requestDeleteMessage\}/)
  })

  it('MessageBubble deletes via gestures, not a visible button', () => {
    const source = read('src/components/MessageBubble.jsx')
    // desktop right-click menu
    expect(source).toContain('onContextMenu={canDelete ? handleContextMenu : undefined}')
    // touch long-press (phone) — no double-tap logic anymore
    expect(source).toContain('onTouchStart={canDelete ? handleTouchStart : undefined}')
    expect(source).toContain('onTouchMove={canDelete ? handleTouchMove : undefined}')
    expect(source).toContain('onTouchEnd={canDelete ? handleTouchEnd : undefined}')
    expect(source).not.toContain('isDoubleTap')
    expect(source).toContain('LONG_PRESS_MS')
    expect(source).toContain('Delete message')
    // no hover trash button anymore (msg__deleted-text is a different class —
    // match the exact standalone delete button class, not the substring)
    expect(source).not.toMatch(/className="msg__delete"/)
    const css = read('src/styles/global.css')
    expect(css).not.toMatch(/\.msg__delete(?![a-z-])/)
    expect(css).toContain('.msg-menu')
  })

  it('ConversationList no longer accepts onDelete and renders no row delete button', () => {
    const list = read('src/components/ConversationList.jsx')
    expect(list).not.toContain('onDelete')
    expect(list).not.toContain('conversation__delete')
  })

  it('unread badge reads from the conversation object and clears in openConversation', () => {
    const chat = read('src/pages/Chat.jsx')
    // single source of truth: badge reads conversation.unread
    expect(chat).toContain('unread,')
    // the OPEN conversation always shows 0 (you're reading it)
    expect(chat).toContain('conversation.id === activeIdRef.current ? 0 : unreadMap[conversation.id] || 0')
    // opening a chat zeroes the badge on the conversation object
    expect(chat).toMatch(/setConversations\([\s\S]*?c\.id === conversationId \? \{ \.\.\.c, unread: 0 \}/)
  })

  it('incoming message in the OPEN chat advances the read cursor (no phantom count)', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('if (convId === activeIdRef.current) {')
    expect(chat).toMatch(/markConversationRead\(convId\)\.catch\(\(\) => \{\}\)/)
  })
})

describe('in-app confirmation replaces window.confirm for deletes', () => {
  it('Chat uses ConfirmDialog state, not window.confirm', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain("import ConfirmDialog from '../components/ConfirmDialog'")
    expect(chat).not.toContain('window.confirm')
    expect(chat).toContain('<ConfirmDialog')
    expect(chat).toContain('requestDeleteConversation')
    expect(chat).toContain('requestDeleteMessage')
  })

  it('SPA fallback config exists for refresh-404 (Vercel / Netlify / CF Pages)', () => {
    expect(has('vercel.json')).toBe(true)
    expect(has('netlify.toml')).toBe(true)
    expect(has('public/_redirects')).toBe(true)
    expect(read('vercel.json')).toContain('rewrites')
    expect(read('netlify.toml')).toContain('/index.html')
  })
})

describe('mobile keyboard — composer stays above the keyboard', () => {
  it('viewport meta enables keyboard-driven resize', () => {
    const html = read('index.html')
    expect(html).toContain('interactive-widget=resizes-content')
    expect(html).toContain('viewport-fit=cover')
  })

  it('chat height uses dynamic viewport + visualViewport override', () => {
    const css = read('src/styles/global.css')
    expect(css).toMatch(/\.chat \{[\s\S]*?height: 100vh;[\s\S]*?height: 100dvh;[\s\S]*?height: var\(--app-height, 100dvh\)/)
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain("window.visualViewport")
    expect(chat).toContain("'--app-height'")
  })

  it('composer nudges itself into view on focus', () => {
    const input = read('src/components/MessageInput.jsx')
    expect(input).toContain('onFocus={handleFocus}')
    expect(input).toContain('scrollIntoView({ block: \'nearest\', behavior: \'smooth\' })')
  })
})

describe('phone performance + hCaptcha robustness', () => {
  it('sidebar refresh is debounced (fewer re-fetches on phones)', () => {
    const chat = read('src/pages/Chat.jsx')
    expect(chat).toContain('reloadTimerRef')
    expect(chat).toContain('setTimeout(() => {')
    expect(chat).toContain('loadConversations()')
    expect(chat).toContain('250')
  })

  it('avatar images are lazy + async decoded', () => {
    const avatar = read('src/components/Avatar.jsx')
    expect(avatar).toContain('loading="lazy"')
    expect(avatar).toContain('decoding="async"')
  })

  it('hCaptcha is preconnected, preloaded, and resets precisely', () => {
    const html = read('index.html')
    expect(html).toContain('preconnect')
    expect(html).toContain('https://js.hcaptcha.com')
    const captcha = read('src/lib/captcha.js')
    expect(captcha).toContain('preloadCaptcha')
    expect(captcha).toContain('renderedWidgetIds')
    expect(captcha).toContain('window.hcaptcha.reset(id)')
    const app = read('src/App.jsx')
    expect(app).toContain("preloadCaptcha()")
  })
})
