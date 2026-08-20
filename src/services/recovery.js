// ---------------------------------------------------------------------------
// Recovery service — talks to the ONE Edge Function: recover-password.
//
// The Edge Function is the only server-side component in hushh. It exists
// because a logged-out browser must never be able to perform an
// administrative password reset directly. It verifies the Recovery ID hash
// and the PBKDF2 security-answer hash, rate-limits failed attempts, and uses
// the Supabase Admin API (service_role) to change the Auth password.
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase'

function extractMessage(data, fallback) {
  if (data && typeof data.error === 'string') return data.error
  return fallback
}

/**
 * Step 1 of recovery: given a Recovery ID, return the associated security
 * question id. Only the question id comes back — never hashes, salts,
 * answers or user ids.
 */
export async function lookupRecoveryQuestion(recoveryId) {
  const { data, error } = await supabase.functions.invoke('recover-password', {
    body: { action: 'lookup', recoveryId },
  })
  if (error) {
    const context = error.context || {}
    throw new Error(extractMessage(context, 'Something went wrong. Please try again.'))
  }
  if (!data || data.success !== true) {
    throw new Error(extractMessage(data, 'Something went wrong. Please try again.'))
  }
  return data // { success: true, securityQuestionId }
}

/**
 * Complete recovery: Recovery ID + security answer + new password.
 */
export async function resetPasswordWithRecovery({ recoveryId, securityAnswer, newPassword }) {
  const { data, error } = await supabase.functions.invoke('recover-password', {
    body: { action: 'reset', recoveryId, securityAnswer, newPassword },
  })
  if (error) {
    const context = error.context || {}
    throw new Error(extractMessage(context, 'Something went wrong. Please try again.'))
  }
  if (!data || data.success !== true) {
    throw new Error(extractMessage(data, 'Something went wrong. Please try again.'))
  }
  return data // { success: true }
}
