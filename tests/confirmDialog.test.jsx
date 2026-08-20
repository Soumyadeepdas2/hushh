// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ConfirmDialog from '../src/components/ConfirmDialog'

// ---------------------------------------------------------------------------
// In-app confirmation modal (replaces window.confirm) for delete chat/message.
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
  title: 'Delete your chat with Soumyadeep?',
  message: 'This only removes the chat for you.',
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', async () => {
    await act(async () => {
      root.render(<ConfirmDialog open={false} title={base.title} message={base.message} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    })
    expect(document.querySelector('.confirm-dialog')).toBeNull()
  })

  it('shows title, message and Cancel/Delete buttons when open', async () => {
    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    })
    const dialog = document.querySelector('.confirm-dialog')
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Delete your chat with Soumyadeep?')
    expect(dialog.textContent).toContain('This only removes the chat for you.')
    const buttons = dialog.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    expect(buttons[0].textContent).toBe('Cancel')
    expect(buttons[1].textContent).toBe('Delete')
  })

  it('calls onCancel on Cancel and onConfirm on Delete', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} onConfirm={onConfirm} onCancel={onCancel} />)
    })
    const buttons = document.querySelectorAll('.confirm-dialog button')
    await act(async () => {
      buttons[0].click()
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} onConfirm={onConfirm} onCancel={onCancel} />)
    })
    await act(async () => {
      document.querySelectorAll('.confirm-dialog button')[1].click()
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const onCancel = vi.fn()
    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} onConfirm={vi.fn()} onCancel={onCancel} />)
    })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows a busy label while deleting and disables the buttons', async () => {
    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} busy onConfirm={vi.fn()} onCancel={vi.fn()} />)
    })
    const buttons = document.querySelectorAll('.confirm-dialog button')
    expect(buttons[1].textContent).toBe('Deleting…')
    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].disabled).toBe(true)
  })

  it('ignores an outside-click right after opening (no flash-close on touch)', async () => {
    const onCancel = vi.fn()
    await act(async () => {
      root.render(<ConfirmDialog open title={base.title} message={base.message} onConfirm={vi.fn()} onCancel={onCancel} />)
    })
    const backdrop = document.querySelector('.dialog-backdrop')
    // the synthesized mousedown that fires right after the touch gesture lands
    // on the just-rendered backdrop — it must NOT close the dialog
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onCancel).not.toHaveBeenCalled()

    // after the guard window, a genuine outside click closes it
    await new Promise((r) => setTimeout(r, 400))
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
