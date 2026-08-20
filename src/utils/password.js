// ---------------------------------------------------------------------------
// Password policy. This is a UX/validation policy only — the actual password
// is handled by Supabase Auth. hushh never stores or hashes passwords itself.
// The same policy is enforced server-side inside the recover-password Edge
// Function before an admin password update.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required.'
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must include at least one letter.'
  }
  if (!/\d/.test(password)) {
    return 'Password must include at least one number.'
  }
  return null
}

export function isValidPassword(password) {
  return validatePassword(password) === null
}
