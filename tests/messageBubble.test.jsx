// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import MessageBubble from '../src/components/MessageBubble'

// ---------------------------------------------------------------------------
// Gesture-driven message delete:
//   • desktop — right-click your own message → "Delete message" menu
//   • touch   — LONG-PRESS (~0.55s hold) your own message → delete
// ---------------------------------------------------------------------------

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const base = {
  id: 'm1',
  conversation_id: 'c1',
  sender_id: 'me',
  body: 'hello',
  created_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

describe('MessageBubble — right-click delete (desktop)', () => {
  it('opens the Delete message menu on right-click of my own message', async () => {
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={vi.fn()} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }))
    })
    expect(document.querySelector('.msg-menu')).not.toBeNull()
    expect(document.querySelector('.msg-menu').textContent).toContain('Delete message')
  })

  it('clicking Delete message calls onDelete with the message and closes the menu', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }))
    })
    await act(async () => {
      document.querySelector('.msg-menu__item').click()
    })
    expect(onDelete).toHaveBeenCalledWith(base)
    expect(document.querySelector('.msg-menu')).toBeNull()
  })

  it('does NOT open a menu on other people’s messages', async () => {
    await act(async () => {
      root.render(
        <MessageBubble message={{ ...base, sender_id: 'other' }} own={false} onDelete={vi.fn()} />,
      )
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    })
    expect(document.querySelector('.msg-menu')).toBeNull()
  })
})

describe('MessageBubble — long-press delete (touch)', () => {
  // jsdom has no TouchEvent — plain bubbling events are enough; the handler
  // only reads e.touches when it exists
  const touchStart = () => new Event('touchstart', { bubbles: true })
  const touchMove = () => new Event('touchmove', { bubbles: true })
  const touchEnd = () => new Event('touchend', { bubbles: true })

  it('holding for ~0.55s on my own message calls onDelete', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(touchStart())
    })
    await act(async () => {
      await wait(650)
    })
    expect(onDelete).toHaveBeenCalledWith(base)
  })

  it('a quick tap (release before the hold) does NOT delete', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(touchStart())
      bubble.dispatchEvent(touchEnd())
    })
    await act(async () => {
      await wait(650)
    })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('scrolling (touchmove) cancels the long-press', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(touchStart())
      bubble.dispatchEvent(touchMove())
    })
    await act(async () => {
      await wait(650)
    })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does NOT delete on other people’s messages', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(
        <MessageBubble message={{ ...base, sender_id: 'other' }} own={false} onDelete={onDelete} />,
      )
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(touchStart())
    })
    await act(async () => {
      await wait(650)
    })
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('does NOT react on already-deleted messages', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(
        <MessageBubble message={{ ...base, deleted_at: '2026-01-02T00:00:00Z' }} own onDelete={onDelete} />,
      )
    })
    // deleted bubble renders the placeholder, not a live message
    expect(document.body.textContent).toContain('This message was deleted.')
    expect(document.querySelector('.msg__body')).toBeNull()
    // no delete handlers on the deleted bubble
    expect(document.querySelector('.msg').getAttribute('oncontextmenu')).toBeNull()
    expect(document.querySelector('.msg').getAttribute('ontouchstart')).toBeNull()
  })
})
