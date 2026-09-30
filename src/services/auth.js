

import { supabase } from '../lib/supabase'
import { chatIdToEmail } from '../utils/emailMapping'
import { buildCaptchaAuthOptions } from '../lib/captcha'

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
