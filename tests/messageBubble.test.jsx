// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import MessageBubble, { isDoubleTap } from '../src/components/MessageBubble'

// ---------------------------------------------------------------------------
// Gesture-driven message delete:
//   • desktop — right-click your own message → "Delete message" menu
//   • touch   — double-tap your own message → delete
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

describe('isDoubleTap (pure)', () => {
  it('returns true when the second tap lands within the threshold', () => {
    expect(isDoubleTap(1000, 1150)).toBe(true)
    expect(isDoubleTap(1000, 1300)).toBe(true)
  })

  it('returns false for single taps and slow taps', () => {
    expect(isDoubleTap(0, 1300)).toBe(false)
    expect(isDoubleTap(null, 1300)).toBe(false)
    expect(isDoubleTap(1000, 1500)).toBe(false) // > 300ms
  })
})

describe('MessageBubble — right-click delete (desktop)', () => {
  it('opens the Delete message menu on right-click of my own message', async () => {
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={vi.fn()} />)
    })
    const bubble = document.querySelector('.msg')
    const evt = new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
    await act(async () => {
      bubble.dispatchEvent(evt)
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

  it('does NOT open a menu on already-deleted messages', async () => {
    await act(async () => {
      root.render(
        <MessageBubble message={{ ...base, deleted_at: '2026-01-02T00:00:00Z' }} own onDelete={vi.fn()} />,
      )
    })
    expect(document.querySelector('.msg-menu')).toBeNull()
    expect(document.body.textContent).toContain('This message was deleted.')
  })
})

describe('MessageBubble — double-tap delete (touch)', () => {
  it('double-tapping my own message calls onDelete', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')

    await act(async () => {
      bubble.dispatchEvent(new Event('touchend', { bubbles: true }))
    })
    // second tap within 300ms — triggers the delete
    await act(async () => {
      bubble.dispatchEvent(new Event('touchend', { bubbles: true }))
    })
    expect(onDelete).toHaveBeenCalledWith(base)
  })

  it('a single tap does NOT delete', async () => {
    const onDelete = vi.fn()
    await act(async () => {
      root.render(<MessageBubble message={base} own onDelete={onDelete} />)
    })
    const bubble = document.querySelector('.msg')
    await act(async () => {
      bubble.dispatchEvent(new Event('touchend', { bubbles: true }))
    })
    expect(onDelete).not.toHaveBeenCalled()
  })
})
