import { useRef, useState } from 'react'
import { MESSAGE_MAX_LENGTH } from '../utils/messages'

// ---------------------------------------------------------------------------
// Message composer. Enter sends, Shift+Enter inserts a newline.
// Empty and over-long messages are blocked (validated again in the service
// layer and constrained by the database CHECK constraint).
// ---------------------------------------------------------------------------

export default function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const handleChange = (e) => {
    setValue(e.target.value)
    autoResize()
  }

  const submit = () => {
    const body = value.trim()
    if (!body) return
    onSend(body)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // Mobile keyboard fix: when the field is focused, nudge the composer into
  // the visible area (the visualViewport height fix handles sizing; this
  // covers cases where the browser's own auto-scroll is slow).
  const handleFocus = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  const overLimit = value.length > MESSAGE_MAX_LENGTH

  return (
    <div className="composer">
      <textarea
        ref={textareaRef}
        className="composer__input"
        rows={1}
        placeholder={disabled ? 'Select a conversation…' : 'Write a message…'}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        maxLength={MESSAGE_MAX_LENGTH + 200}
        disabled={disabled}
        aria-label="Message"
      />
      {value.length > MESSAGE_MAX_LENGTH - 200 && (
        <span className={`composer__count ${overLimit ? 'composer__count--over' : ''}`}>
          {value.length}/{MESSAGE_MAX_LENGTH}
        </span>
      )}
      <button
        type="button"
        className="btn btn--primary composer__send"
        onClick={submit}
        disabled={disabled || !value.trim() || overLimit}
      >
        Send
      </button>
    </div>
  )
}
