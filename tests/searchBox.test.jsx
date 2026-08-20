// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// Mock the profiles service so the search is deterministic without network.
vi.mock('../src/services/profiles', () => ({
  searchProfiles: vi.fn(async () => [
    { id: 'u1', display_name: 'Soumyadeep', chat_id: 'soumyadeep', avatar_id: null },
    { id: 'u2', display_name: 'Soumya', chat_id: 'soumya', avatar_id: null },
  ]),
}))

import SearchBox from '../src/components/SearchBox'
import { searchProfiles } from '../src/services/profiles'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const type = async (value) => {
  const input = document.querySelector('.input--search')
  // React tracks its own value — use the native setter so onChange fires
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // let the debounce + async search settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 350))
  })
}

describe('SearchBox clears the query + results after selecting a user', () => {
  it('typing shows results, selecting one clears the input and the list', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      root.render(<SearchBox myProfileId="me" onSelect={onSelect} />)
    })

    await type('soumya')
    expect(searchProfiles).toHaveBeenCalled()
    expect(document.querySelectorAll('.search__result').length).toBe(2)

    const firstButton = document.querySelector('.search__result .btn--small')
    await act(async () => {
      firstButton.click()
    })

    // onSelect was called with the picked user
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].chat_id).toBe('soumyadeep')

    // the search box + results are cleared
    expect(document.querySelector('.input--search').value).toBe('')
    expect(document.querySelector('.search__results')).toBeNull()
    expect(document.querySelector('.search__hint')).toBeNull()
  })

  it('a fresh query re-searches after a previous selection', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      root.render(<SearchBox myProfileId="me" onSelect={onSelect} />)
    })

    await type('soumya')
    await act(async () => {
      document.querySelector('.search__result .btn--small').click()
    })
    expect(document.querySelector('.input--search').value).toBe('')

    // typing again works (state fully reset)
    await type('soumya')
    expect(document.querySelectorAll('.search__result').length).toBe(2)
  })
})
