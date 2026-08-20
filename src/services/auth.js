// ---------------------------------------------------------------------------
// Auth service — wraps Supabase Auth.
//
// Users only ever see Chat ID + password. The internal email derived from the
// Chat ID (see utils/emailMapping.js) is an implementation detail and is
// never surfaced in the UI.
//
// Passwords are handled entirely by Supabase Auth. hushh never creates its
// own password database and never hashes login passwords.
//
// CAPTCHA: when a token is present it is forwarded to signUp() and
// signInWithPassword() as the Supabase Auth captchaToken; Supabase verifies
// it server-side against the secret configured in the Dashboard. No token =
// no CAPTCHA (dev/preview). With CAPTCHA enabled in Supabase, sign-in
// REQUIRES the token — without it Supabase rejects the request (400).
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase'
import { chatIdToEmail } from '../utils/emailMapping'
import { buildCaptchaAuthOptions } from '../lib/captcha'

// Map raw Supabase/GoTrue error text to friendly, non-technical messages.
export function toFriendlyAuthError(error) {
  const message = error?.message || ''
  if (/already registered|already been registered|user already exists/i.test(message)) {
    return 'That Chat ID is already taken.'
  }
  if (/invalid login credentials|email not confirmed|user not found/i.test(message)) {
    return 'Incorrect Chat ID or password.'
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (/captcha/i.test(message)) {
    return 'CAPTCHA verification failed. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

export async function signInWithChatId(chatId, password, captchaToken) {
  const email = chatIdToEmail(chatId)
  const captchaOptions = buildCaptchaAuthOptions(captchaToken)
  const { data, error } = await supabase.auth.signInWithPassword(
    captchaOptions ? { email, password, options: captchaOptions } : { email, password },
  )
  if (error) throw new Error(toFriendlyAuthError(error))
  return data
}

export async function signUpWithChatId({ chatId, password, captchaToken }) {
  const email = chatIdToEmail(chatId)
  const captchaOptions = buildCaptchaAuthOptions(captchaToken)
  const { data, error } = await supabase.auth.signUp(
    captchaOptions ? { email, password, options: captchaOptions } : { email, password },
  )
  if (error) throw new Error(toFriendlyAuthError(error))
  if (!data.session) {
    // This happens when "Confirm email" is enabled in the Supabase project.
    // hushh requires email confirmation to be DISABLED (see README).
    throw new Error(
      'Account created, but sign-in is pending. Confirm that "Confirm email" is disabled in your Supabase Auth settings, then try again.',
    )
  }
  return { user: data.user, session: data.session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error('Something went wrong. Please try again.')
}
