import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import RecoveryDialog from '../components/RecoveryDialog'

const RecoveryContext = createContext(null)

export function RecoveryProvider({ children }) {

  const [pending, setPending] = useState(null)

  const show = useCallback((chatId, recoveryId) => {
    setPending({ chatId, recoveryId })
  }, [])

  const dismiss = useCallback(() => {

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
