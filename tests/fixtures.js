// Shared fixtures for the security test suites.

// A valid Recovery ID in the current 7-group (140-bit) format.
export const VALID_RECOVERY_ID = 'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-K2RT'

// Invalid / legacy / hostile Recovery IDs.
export const INVALID_RECOVERY_IDS = [
  'RC-8FQ2-M7KD-XP9A', // legacy 60-bit format
  'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD', // 6 groups = 120 bits, not enough
  'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7C!-K2RT', // invalid character
  'RC-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-K2RT1', // too long
  'CH-8FQ2-M7KD-XP9A-G3HW-N5LB-Q7CD-K2RT', // wrong prefix
  'soumyadeep', // a Chat ID is not a Recovery ID
]
