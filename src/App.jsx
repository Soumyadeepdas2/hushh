import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { RecoveryProvider } from './hooks/useRecovery'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Chat from './pages/Chat'
import { isSupabaseConfigured } from './lib/supabase'
import { preloadCaptcha } from './lib/captcha'

// Redirect authenticated users away from the auth pages.
function GuestOnly({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="page-loading">Loading…</div>
  if (session) return <Navigate to="/chat" replace />
  return children
}

export default function App() {
  // start loading hCaptcha as early as possible so Sign in / Create account
  // don't wait on a slow first load (especially on phones)
  useEffect(() => {
    preloadCaptcha()
  }, [])

  return (
    <AuthProvider>
      {/* RecoveryProvider renders the one-time Recovery ID dialog ABOVE the
          router so the post-signup /chat redirect cannot destroy it. */}
      <RecoveryProvider>
        <BrowserRouter>
          {!isSupabaseConfigured && (
            <div className="banner">
              hushh isn&apos;t connected to Supabase yet. Copy <code>.env.example</code> to{' '}
              <code>.env</code> and add your <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code>.
            </div>
          )}
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/register"
              element={
                <GuestOnly>
                  <Register />
                </GuestOnly>
              }
            />
            <Route
              path="/login"
              element={
                <GuestOnly>
                  <Login />
                </GuestOnly>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <GuestOnly>
                  <ForgotPassword />
                </GuestOnly>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </RecoveryProvider>
    </AuthProvider>
  )
}
