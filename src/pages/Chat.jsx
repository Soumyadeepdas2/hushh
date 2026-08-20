import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import SearchBox from '../components/SearchBox'
import ConversationList from '../components/ConversationList'
import MessageBubble from '../components/MessageBubble'
import MessageInput from '../components/MessageInput'
import { useAuth } from '../hooks/useAuth'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { useRealtimeConversations } from '../hooks/useRealtimeConversations'
import { signOut } from '../services/auth'
import {
  getOrCreateConversation,
  listConversations,
  listConversationParticipants,
  listLastMessages,
} from '../services/conversations'
import { deleteMessage, fetchMessages, sendMessage } from '../services/messages'
import { getProfileBrief } from '../services/profiles'
import { Button } from '../components/ui'

// ---------------------------------------------------------------------------
// Chat — the protected app screen.
//
// Layout: sidebar (profile, search, conversation list) + message pane.
// Responsive: single-pane mobile switching between list and conversation.
//
// Realtime: messages arrive via Supabase Realtime (postgres_changes), which
// is RLS-enforced — a client only receives events for conversations it can
// SELECT. No polling.
// ---------------------------------------------------------------------------

const SORT = (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

function upsertMessage(list, incoming) {
  const index = list.findIndex((m) => m.id === incoming.id)
  if (index === -1) {
    return [...list, incoming].sort(SORT)
  }
  const next = [...list]
  next[index] = incoming
  return next.sort(SORT)
}

function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

export default function Chat() {
  const { session, profile, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [peer, setPeer] = useState(null)
  const [busy, setBusy] = useState(true)
  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat'
  const [toast, setToast] = useState(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const showToast = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  // ---- profile race safety net ---------------------------------------------
  // If the session exists but the profile is missing (the auth listener can
  // fetch the profile before the registration INSERT commits), re-fetch a
  // few times automatically so the chat screen self-heals instead of showing
  // the "profile could not be loaded" dead end. Stops once the profile loads
  // or after 4 attempts — never loops forever.
  useEffect(() => {
    if (!session?.user || profile) return undefined
    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      if (attempts > 4) {
        clearInterval(timer)
        return
      }
      await refreshProfile(session.user.id)
    }, 1200)
    return () => clearInterval(timer)
  }, [session?.user, profile, refreshProfile])

  const handleRetryProfile = async () => {
    if (session?.user) await refreshProfile(session.user.id)
  }

  // ---- conversation list ---------------------------------------------------

  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversations()
      const participantRows = await listConversationParticipants(list.map((c) => c.id))
      const profileIds = [...new Set(participantRows.map((p) => p.user_id))]
      const briefs = await getProfileBrief(profileIds)
      const briefMap = new Map(briefs.map((b) => [b.id, b]))
      const lastMessages = await listLastMessages(list.map((c) => c.id))

      const enriched = list
        .map((conversation) => {
          const others = participantRows.filter(
            (p) => p.conversation_id === conversation.id && p.user_id !== profile?.id,
          )
          const other = others.length ? briefMap.get(others[0].user_id) || null : null
          const latest = lastMessages.get(conversation.id)
          return {
            ...conversation,
            other,
            lastMessage: latest
              ? latest.deleted_at
                ? { deleted: true, created_at: latest.created_at }
                : { body: latest.body, created_at: latest.created_at }
              : null,
          }
        })
        .sort((a, b) => {
          const ta = new Date(a.last_message_at || a.created_at).getTime()
          const tb = new Date(b.last_message_at || b.created_at).getTime()
          return tb - ta
        })

      setConversations(enriched)
    } catch {
      showToast('Could not load conversations.')
    }
  }, [profile?.id, showToast])

  useEffect(() => {
    if (!session || !profile) return
    loadConversations()
    setBusy(false)
  }, [session, profile, loadConversations])

  // Realtime: refresh the sidebar whenever anything changes in a conversation
  // the user is part of.
  useRealtimeConversations(() => {
    loadConversations()
  })

  // ---- opening a conversation ----------------------------------------------

  const openConversation = useCallback(
    async (conversationId) => {
      if (!conversationId) return
      setActiveId(conversationId)
      setMobileView('chat')
      setMessages([])
      setPeer(null)
      try {
        const [history, participantRows] = await Promise.all([
          fetchMessages(conversationId),
          listConversationParticipants([conversationId]),
        ])
        setMessages(history)
        const otherRow = participantRows.find((r) => r.user_id !== profile?.id)
        if (otherRow) {
          const briefs = await getProfileBrief([otherRow.user_id])
          setPeer(briefs[0] || null)
        }
      } catch {
        showToast('Could not load messages.')
      }
    },
    [profile?.id, showToast],
  )

  // Realtime: append/update messages for the active conversation.
  const handleMessageEvent = useCallback(
    (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setMessages((prev) => upsertMessage(prev, payload.new))
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === payload.new.conversation_id
                ? {
                    ...c,
                    last_message_at: payload.new.created_at,
                    lastMessage: payload.new.deleted_at
                      ? { deleted: true, created_at: payload.new.created_at }
                      : { body: payload.new.body, created_at: payload.new.created_at },
                  }
                : c,
            )
            .sort((a, b) => {
              const ta = new Date(a.last_message_at || a.created_at).getTime()
              const tb = new Date(b.last_message_at || b.created_at).getTime()
              return tb - ta
            }),
        )
      }
    },
    [],
  )
  useRealtimeMessages(activeId, handleMessageEvent)

  // ---- actions -------------------------------------------------------------

  const handleSend = async (body) => {
    if (!activeId || !profile) return
    try {
      await sendMessage({ conversationId: activeId, senderId: profile.id, body })
      // Refresh to guarantee the sender's own message is in the list even if a
      // realtime event is momentarily missed. Realtime keeps delivering the
      // other side live — this is not polling.
      const history = await fetchMessages(activeId)
      setMessages(history)
    } catch (err) {
      showToast(err.message)
    }
  }

  const handleDelete = async (message) => {
    if (!message || message.deleted_at || message.sender_id !== profile?.id) return
    try {
      await deleteMessage(message.id)
      // Optimistic local update; the realtime UPDATE event confirms it.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, deleted_at: new Date().toISOString() } : m,
        ),
      )
    } catch {
      showToast('Could not delete that message.')
    }
  }

  const handleStartConversation = async (user) => {
    try {
      const { conversation_id: conversationId } = await getOrCreateConversation(user.id)
      if (!conversationId) {
        showToast('Could not start that conversation.')
        return
      }
      await loadConversations()
      await openConversation(conversationId)
    } catch {
      showToast('Could not start that conversation.')
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch {
      // session is cleared locally regardless
    }
    navigate('/login', { replace: true })
  }

  const handleBack = () => {
    setActiveId(null)
    setMobileView('list')
  }

  // ---- scroll to bottom on new messages ------------------------------------

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 160
    if (nearBottom || mobileView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length, activeId, mobileView])

  const viewClass = mobileView === 'chat' ? 'chat--convo' : 'chat--list'

  if (loading) return <div className="page-loading">Loading…</div>

  if (session && !profile) {
    return (
      <div className="page-loading page-loading--error">
        <p>Your profile could not be loaded.</p>
        <p className="page-loading__sub">
          Don&apos;t worry — your account was created successfully. Try loading it again.
        </p>
        <div className="page-loading__actions">
          <button type="button" className="btn btn--accent" onClick={handleRetryProfile}>
            Retry
          </button>
          <button type="button" className="btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat ${viewClass}`}>
      {/* ---------------- sidebar ---------------- */}
      <aside className="chat-side">
        <div className="chat-side__header">
          <Link to="/" className="chat-side__logo" aria-label="hushh home">
            <Logo size="sm" />
          </Link>
          <button type="button" className="btn btn--ghost btn--small" onClick={handleLogout}>
            Log out
          </button>
        </div>

        <div className="chat-side__me">
          <span className="avatar" aria-hidden="true">
            {initials(profile?.display_name)}
          </span>
          <div className="chat-side__me-text">
            <span className="chat-side__me-name">{profile?.display_name}</span>
            <span className="chat-side__me-chatid">@{profile?.chat_id}</span>
          </div>
        </div>

        <div className="chat-side__search">
          <SearchBox myProfileId={profile?.id} onSelect={handleStartConversation} />
        </div>

        <nav className="chat-side__list" aria-label="Conversations">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onOpen={openConversation}
          />
        </nav>
      </aside>

      {/* ---------------- message pane ---------------- */}
      <main className="chat-main">
        {!activeId ? (
          <div className="chat-empty">
            <span className="chat-empty__mark" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="chat-empty__title">Select a conversation</p>
            <p className="chat-empty__sub">
              Search a Chat ID on the left to start talking.
            </p>
          </div>
        ) : (
          <>
            <header className="chat-main__header">
              <button type="button" className="btn btn--ghost btn--small btn--back" onClick={handleBack}>
                ← Back
              </button>
              <span className="avatar avatar--navy" aria-hidden="true">
                {initials(peer?.display_name)}
              </span>
              <div className="chat-main__peer">
                <span className="chat-main__peer-name">{peer?.display_name || '…'}</span>
                <span className="chat-main__peer-chatid">@{peer?.chat_id || '…'}</span>
              </div>
              <span className="chat-main__tag">private</span>
            </header>

            <div className="messages" ref={messagesContainerRef}>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={message.sender_id === profile?.id}
                />
              ))}
              {messages.length === 0 && (
                <p className="messages-empty">No messages yet — say hello.</p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <MessageInput onSend={handleSend} disabled={!activeId} />
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
