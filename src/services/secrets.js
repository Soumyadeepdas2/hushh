// ---------------------------------------------------------------------------
// User secrets service.
//
// Only the hashed/derived values ever leave this module:
//   - recovery_id_hash         : SHA-256 of the normalized Recovery ID
//   - security_question_id     : id of the fixed question list
//   - security_answer_hash     : PBKDF2-HMAC-SHA256 (per-user salt)
//   - security_answer_salt     : unique random salt
//
// The plaintext Recovery ID and plaintext security answer are computed in the
// registration flow, used to derive these hashes, and then dropped from state.
// They are never sent to the database and never logged.
// ---------------------------------------------------------------------------

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
