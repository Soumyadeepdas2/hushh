function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// A single message bubble. Deleted messages render as an italic placeholder —
// the body is never shown again after deletion.
// ---------------------------------------------------------------------------

export default function MessageBubble({ message, own }) {
  if (message.deleted_at) {
    return (
      <div className={`msg msg--deleted ${own ? 'msg--own' : 'msg--other'}`}>
        <span className="msg__deleted-text">This message was deleted.</span>
        <span className="msg__time">{formatTime(message.created_at)}</span>
      </div>
    )
  }

  return (
    <div className={`msg ${own ? 'msg--own' : 'msg--other'}`}>
      <span className="msg__body">{message.body}</span>
      <span className="msg__time">{formatTime(message.created_at)}</span>
    </div>
  )
}
