// ---------------------------------------------------------------------------
// Auth context: Supabase Auth session + the caller's own profile.
//
// Listens for auth state changes (onAuthStateChange). The chat route is
// protected by ProtectedRoute; logged-out users are redirected to /login.
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    // RLS allows reading only your own profile row.
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, chat_id')
      .eq('auth_user_id', userId)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) refreshProfile(data.session.user.id)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) refreshProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [refreshProfile])

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
