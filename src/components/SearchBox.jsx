import { useEffect, useState } from 'react'
import { searchProfiles } from '../services/profiles'
import Avatar from './Avatar'

// ---------------------------------------------------------------------------
// Search users by Chat ID. Results only ever contain the public profile
// fields: id (opaque), display_name, chat_id, avatar_id. No emails, no auth
// IDs, no recovery information.
// ---------------------------------------------------------------------------

export default function SearchBox({ myProfileId, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const q = query.trim().replace(/^@+/, '')
    if (q.length < 2) {
      setResults([])
      setBusy(false)
      return undefined
    }

    let cancelled = false
    setBusy(true)
    const timer = setTimeout(async () => {
      const found = await searchProfiles(q)
      if (!cancelled) {
        setResults(found.filter((r) => r.id !== myProfileId))
      }
      setBusy(false)
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, myProfileId])

  const handleSelect = (user) => {
    // Clear the search so the box + results vanish after choosing a user.
    setQuery('')
    setResults([])
    onSelect(user)
  }

  return (
    <div className="search">
      <input
        type="search"
        className="input input--search"
        placeholder="Find someone by Chat ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search users by Chat ID"
      />
      {busy && <p className="search__hint">Searching…</p>}
      {!busy && query.trim().replace(/^@+/, '').length > 0 && results.length === 0 && (
        <p className="search__hint">No one found with that Chat ID.</p>
      )}
      {results.length > 0 && (
        <ul className="search__results">
          {results.map((user) => (
            <li key={user.id} className="search__result">
              <div className="search__result-info">
                <Avatar profile={user} size="sm" />
                <div className="search__result-text">
                  <span className="search__result-name">{user.display_name}</span>
                  <span className="search__result-chatid">@{user.chat_id}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => handleSelect(user)}
              >
                Message
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
