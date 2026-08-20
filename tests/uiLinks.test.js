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
    // message bubbles get the delete handler (right-click / double-tap)
    expect(chat).toMatch(/<MessageBubble[\s\S]*?onDelete=\{handleDelete\}/)
  })

  it('MessageBubble deletes via gestures, not a visible button', () => {
    const source = read('src/components/MessageBubble.jsx')
    expect(source).toContain('onContextMenu={canDelete ? handleContextMenu : undefined}')
    expect(source).toContain('onTouchEnd={canDelete ? handleTouchEnd : undefined}')
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
    expect(chat).toContain('unread: unreadMap[conversation.id] || 0')
    // opening a chat zeroes the badge on the conversation object
    expect(chat).toMatch(/setConversations\([\s\S]*?c\.id === conversationId \? \{ \.\.\.c, unread: 0 \}/)
  })
})
