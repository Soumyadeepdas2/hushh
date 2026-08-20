// The fixed list of security questions offered during registration.
// Only the question ID is stored in the database — never the plaintext answer.

export const SECURITY_QUESTIONS = [
  { id: 1, text: 'What was the name of your first pet?' },
  { id: 2, text: 'What was the name of your first school?' },
  { id: 3, text: 'What was your childhood nickname?' },
  { id: 4, text: 'What was your favorite childhood game?' },
  { id: 5, text: 'What is the name of your hometown?' },
  { id: 6, text: 'What was the make and model of your first car?' },
]

export function securityQuestionById(id) {
  const questionId = Number(id)
  return SECURITY_QUESTIONS.find((q) => q.id === questionId) || null
}
