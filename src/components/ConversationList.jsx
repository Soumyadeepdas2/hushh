function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Sidebar conversation list.
// ---------------------------------------------------------------------------

export default function ConversationList({ conversations, activeId, onOpen }) {
  if (conversations.length === 0) {
    return (
      <div className="conversations-empty">
        <p>No conversations yet.</p>
        <p className="conversations-empty__sub">
          Search a Chat ID above to start one.
        </p>
      </div>
    )
  }

  return (
    <ul className="conversations">
      {conversations.map((conversation) => {
        const other = conversation.other
        const preview = conversation.lastMessage
          ? conversation.lastMessage.deleted
            ? 'Message deleted'
            : conversation.lastMessage.body
          : 'Say hello…'
        return (
          <li key={conversation.id}>
            <button
              type="button"
              className={`conversation ${conversation.id === activeId ? 'conversation--active' : ''}`}
              onClick={() => onOpen(conversation.id)}
            >
              <span className="avatar conversation__avatar" aria-hidden="true">
                {initials(other?.display_name)}
              </span>
              <span className="conversation__name">
                {other ? other.display_name : 'Unknown'}
              </span>
              <span className="conversation__time">
                {formatTime(conversation.lastMessage?.created_at || conversation.created_at)}
              </span>
              <span className="conversation__chatid">@{other?.chat_id || '…'}</span>
              <span className="conversation__preview">{preview}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
