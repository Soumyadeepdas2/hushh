// ---------------------------------------------------------------------------
// Message validation. v1 is text-only — no file/image/video upload.
// ---------------------------------------------------------------------------

export const MESSAGE_MAX_LENGTH = 2000

export function validateMessageBody(body) {
  if (typeof body !== 'string') {
    return 'Message is required.'
  }
  const trimmed = body.trim()
  if (!trimmed) {
    return 'Message cannot be empty.'
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`
  }
  return null
}
