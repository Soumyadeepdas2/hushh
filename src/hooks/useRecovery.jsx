import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import RecoveryDialog from '../components/RecoveryDialog'

// ---------------------------------------------------------------------------
// One-time Recovery ID display (BUG 2 fix).
//
// Previously the RecoveryDialog lived inside Register's own JSX. On
// successful signup supabase-js emits SIGNED_IN during signUp(), the GuestOnly
// wrapper in App.jsx immediately redirects to /chat, Register unmounts, and
// the local `recovery` state — and therefore the dialog — was destroyed
// before it could be shown.
//
// Fix: the RecoveryDialog is rendered HERE, at the App level (above the
// router and its redirects), so it survives the post-signup navigation.
//
// Security properties (unchanged from the original design):
//   - the plaintext Recovery ID exists ONLY in React state (in-memory)
//   - it is never written to localStorage / sessionStorage / cookies / URL
//   - it is shown exactly once and dropped from state on acknowledge
//   - only the SHA-256 hash is ever sent to the database (user_secrets)
// ---------------------------------------------------------------------------

const RecoveryContext = createContext(null)

export function RecoveryProvider({ children }) {
  // { chatId, recoveryId } — plaintext Recovery ID, in-memory only
  const [pending, setPending] = useState(null)

  const show = useCallback((chatId, recoveryId) => {
    setPending({ chatId, recoveryId })
  }, [])

  const dismiss = useCallback(() => {
    // Drop the plaintext Recovery ID from state immediately.
    setPending(null)
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <RecoveryContext.Provider value={value}>
      {children}
      {pending && (
        <RecoveryDialog
          chatId={pending.chatId}
          recoveryId={pending.recoveryId}
          onDone={dismiss}
        />
      )}
    </RecoveryContext.Provider>
  )
}

export function useRecovery() {
  const context = useContext(RecoveryContext)
  if (!context) throw new Error('useRecovery must be used inside <RecoveryProvider>')
  return context
}
