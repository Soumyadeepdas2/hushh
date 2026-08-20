import Avatar from './Avatar'

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
//   • unread badge (A) — yellow pill with the unseen message count
//   (deleting a chat is done from the open chat window header, not the list)
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
        const unread = conversation.unread || 0
        const isActive = conversation.id === activeId
        return (
          <li key={conversation.id}>
            <button
              type="button"
              className={`conversation ${isActive ? 'conversation--active' : ''}`}
              onClick={() => onOpen(conversation.id)}
            >
              <Avatar profile={other} size="sm" className="conversation__avatar" />
              <span className="conversation__name">
                {other ? other.display_name : 'Unknown'}
              </span>
              <span className="conversation__meta">
                <span className="conversation__time">
                  {formatTime(conversation.lastMessage?.created_at || conversation.created_at)}
                </span>
                {unread > 0 && <span className="conversation__badge">{unread}</span>}
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
