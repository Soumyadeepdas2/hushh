import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Chat ID availability message regression test.
//
// Bug: when a Chat ID was taken, the form showed BOTH a green "This Chat ID
// is already taken." (rendered via Field's `hint`) AND a red
// "That Chat ID is already taken." (a separate warn paragraph) at the same
// time. Fix: green hint is used ONLY for the available case; the taken case
// is expressed via the red `error` slot.
// ---------------------------------------------------------------------------

const root = process.cwd()
const register = readFileSync(resolve(root, 'src/pages/Register.jsx'), 'utf8')

describe('Chat ID availability message (single, correct color)', () => {
  it('renders the green hint ONLY when the Chat ID is available', () => {
    expect(register).toContain(
      "hint={availability === true ? 'This Chat ID is available.' : undefined}",
    )
    // the hint must never carry the "taken" text in green
    expect(register).not.toMatch(/hint=.*This Chat ID is already taken/m)
  })

  it('renders the "taken" message through the red error slot, not the green hint', () => {
    expect(register).toContain(
      "error={errors.chatId || (availability === false ? 'That Chat ID is already taken.' : undefined)}",
    )
  })

  it('no longer renders a duplicate warn paragraph for the taken case', () => {
    expect(register).not.toContain('field-hint--warn')
    expect(register).not.toContain('That Chat ID is already taken.</p>')
  })

  it('still shows the green message exactly once when available', () => {
    const greenHints = (register.match(/This Chat ID is available\./g) || []).length
    expect(greenHints).toBe(1)
  })
})
