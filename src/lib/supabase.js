import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// hushh talks to a cloud-hosted Supabase project ONLY through environment
// variables. No credentials are hardcoded anywhere in the frontend.
//
// VITE_SUPABASE_URL        -> Project URL (https://xxxx.supabase.co)
// VITE_SUPABASE_ANON_KEY   -> anon / publishable key (safe for the frontend)
//
// The service_role key NEVER appears in frontend code. It exists only as a
// secret inside the recover-password Edge Function.
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Placeholder fallbacks keep the UI renderable in development when the
// developer has not yet created a .env file. Real requests will fail with
// friendly errors until real credentials are provided.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
