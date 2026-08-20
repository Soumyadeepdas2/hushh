import { describe, expect, it } from 'vitest'
import { MESSAGE_MAX_LENGTH, validateMessageBody } from '../src/utils/messages'

describe('message validation', () => {
  it('accepts a normal message', () => {
    expect(validateMessageBody('Hello there!')).toBeNull()
  })

  it('rejects empty and whitespace-only messages', () => {
    expect(validateMessageBody('')).toContain('empty')
    expect(validateMessageBody('   ')).toContain('empty')
    expect(validateMessageBody('\n\t')).toContain('empty')
  })

  it('rejects messages over the size limit', () => {
    expect(validateMessageBody('x'.repeat(MESSAGE_MAX_LENGTH + 1))).toContain(
      'characters or fewer',
    )
    expect(validateMessageBody('x'.repeat(MESSAGE_MAX_LENGTH))).toBeNull()
  })

  it('rejects non-string input', () => {
    expect(validateMessageBody(null)).toContain('required')
    expect(validateMessageBody(42)).toContain('required')
  })
})
