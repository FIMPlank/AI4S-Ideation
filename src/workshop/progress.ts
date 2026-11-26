/** Progress counts the facilitator sees before reveal (counts only, never the distribution). */
import { hasRatedAll } from './ratings'
import type { Member, Rating, Selection, Vote } from './types'

export interface Progress {
  done: number
  total: number
}

const participants = (members: readonly Member[]) => members.filter((m) => m.role === 'participant')

/** People who placed all their dots, out of all participants. */
export function voteProgress(members: readonly Member[], votes: readonly Vote[], dotsPerPerson: number): Progress {
  const ps = participants(members)
  const per = new Map<string, number>()
  for (const v of votes) per.set(v.userId, (per.get(v.userId) ?? 0) + 1)
  return { done: ps.filter((m) => (per.get(m.userId) ?? 0) >= dotsPerPerson).length, total: ps.length }
}

/** People who rated every criterion of every strategy item. */
export function ratingProgress(
  members: readonly Member[],
  ratings: readonly Rating[],
  selections: readonly Selection[],
): Progress {
  const ps = participants(members)
  return { done: ps.filter((m) => hasRatedAll(ratings, selections, m.userId)).length, total: ps.length }
}
