/** Limits shared by the UI, the in-memory store and the database constraints. */
export const LIMITS = {
  displayName: 40,
  roomTitle: 120,
  ideaTitle: 120,
  ideaDescription: 1000,
  ideaTarget: 500,
  note: 500,
  implWhat: 300,
  implWho: 80,
  ideasPerGroup: 20,
  /** Participants per room (facilitators don't count). */
  participantsPerRoom: 80,
  maxGroups: 7,
  minDots: 2,
  maxDots: 5,
} as const

/** Ideas the guide card asks for (soft counter, not enforced). */
export const IDEA_GOAL = { min: 2, max: 3 } as const
