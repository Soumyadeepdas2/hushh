

import { supabase } from '../lib/supabase'

function extractMessage(data, fallback) {
  if (data && typeof data.error === 'string') return data.error
  return fallback
}

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
  return data
}

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
  return data
}
