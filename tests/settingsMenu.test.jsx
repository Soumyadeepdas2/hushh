// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsMenu from '../src/components/SettingsMenu'

// ---------------------------------------------------------------------------
// Settings menu (C) render test — avatar grid + logout, opens/closes.
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

const profile = {
  display_name: 'Soumyadeep',
  chat_id: 'soumyadeep',
  avatar_id: 3,
}

describe('SettingsMenu', () => {
  it('starts closed, opens on trigger click', async () => {
    await act(async () => {
      root.render(
        <SettingsMenu profile={profile} onSelectAvatar={vi.fn()} onLogout={vi.fn()} />,
      )
    })
    expect(document.querySelector('.settings__menu')).toBeNull()
    await act(async () => {
      document.querySelector('.settings__trigger').click()
    })
    expect(document.querySelector('.settings__menu')).not.toBeNull()
  })

  it('shows the profile and a grid of all 12 avatars', async () => {
    await act(async () => {
      root.render(
        <SettingsMenu profile={profile} onSelectAvatar={vi.fn()} onLogout={vi.fn()} />,
      )
    })
    await act(async () => {
      document.querySelector('.settings__trigger').click()
    })
    const menu = document.querySelector('.settings__menu')
    expect(menu.textContent).toContain('Soumyadeep')
    expect(menu.textContent).toContain('@soumyadeep')
    const buttons = menu.querySelectorAll('.settings__avatar')
    expect(buttons.length).toBe(12)
    // the currently selected avatar is highlighted
    expect(menu.querySelector('.settings__avatar--active')).not.toBeNull()
  })

  it('calls onSelectAvatar with the chosen id and closes', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      root.render(<SettingsMenu profile={profile} onSelectAvatar={onSelect} onLogout={vi.fn()} />)
    })
    await act(async () => {
      document.querySelector('.settings__trigger').click()
    })
    const buttons = document.querySelectorAll('.settings__avatar')
    await act(async () => {
      buttons[6].click() // avatar 7
    })
    expect(onSelect).toHaveBeenCalledWith(7)
    expect(document.querySelector('.settings__menu')).toBeNull()
  })

  it('calls onLogout from the Log out button', async () => {
    const onLogout = vi.fn()
    await act(async () => {
      root.render(<SettingsMenu profile={profile} onSelectAvatar={vi.fn()} onLogout={onLogout} />)
    })
    await act(async () => {
      document.querySelector('.settings__trigger').click()
    })
    await act(async () => {
      document.querySelector('.settings__logout').click()
    })
    expect(onLogout).toHaveBeenCalledTimes(1)
  })
})
