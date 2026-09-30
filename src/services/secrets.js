

import { supabase } from '../lib/supabase'

export async function createUserSecrets({
  authUserId,
  recoveryIdHash,
  securityQuestionId,
  securityAnswerHash,
  securityAnswerSalt,
}) {
  const { error } = await supabase.from('user_secrets').insert({
    auth_user_id: authUserId,
    recovery_id_hash: recoveryIdHash,
    security_question_id: securityQuestionId,
    security_answer_hash: securityAnswerHash,
    security_answer_salt: securityAnswerSalt,
  })
  if (error) {
    throw new Error('Something went wrong. Please try again.')
  }
}
