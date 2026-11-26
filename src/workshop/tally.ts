import type { Vote } from './types'

export interface Ranked<T> {
  item: T
  score: number
  /** Competition ranking: ties share a rank, the next rank skips (1, 1, 3). */
  rank: number
}

/** Sorts by score (desc), then by the input order; ties share a rank. */
export function rankWithTies<T>(items: readonly T[], score: (item: T) => number): Ranked<T>[] {
  const scored = items.map((item, i) => ({ item, score: score(item), i }))
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  let rank = 0
  return scored.map((s, idx) => {
    if (idx === 0 || s.score !== scored[idx - 1].score) rank = idx + 1
    return { item: s.item, score: s.score, rank }
  })
}

export interface CaseRef {
  id: string
  archetypeId: string
}

export interface CaseTally {
  cardId: string
  archetypeId: string
  dots: number
  rank: number
}

export interface ArchetypeTally {
  archetypeId: string
  dots: number
  rank: number
  /** Dots per case of this archetype, in deck order (heatmap row). */
  cases: { cardId: string; dots: number }[]
}

export interface VoteTally {
  byCase: CaseTally[]
  byArchetype: ArchetypeTally[]
  totalDots: number
  voters: number
  /** Highest dot count of any case (heatmap scale). */
  maxCaseDots: number
}

/**
 * Dot voting result. `cases` in deck order, `archetypeIds` in deck order.
 * Votes on unknown cards are ignored; duplicate votes (same person, same card) count once.
 */
export function tallyVotes(
  votes: readonly Vote[],
  cases: readonly CaseRef[],
  archetypeIds: readonly string[],
): VoteTally {
  const known = new Map(cases.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const dots = new Map<string, number>()
  const voters = new Set<string>()
  for (const v of votes) {
    const k = `${v.userId}\u0000${v.cardId}`
    if (!known.has(v.cardId) || seen.has(k)) continue
    seen.add(k)
    voters.add(v.userId)
    dots.set(v.cardId, (dots.get(v.cardId) ?? 0) + 1)
  }
  const byCase = rankWithTies(cases, (c) => dots.get(c.id) ?? 0).map((r) => ({
    cardId: r.item.id,
    archetypeId: r.item.archetypeId,
    dots: r.score,
    rank: r.rank,
  }))
  const rows = archetypeIds.map((archetypeId) => {
    const cs = cases
      .filter((c) => c.archetypeId === archetypeId)
      .map((c) => ({ cardId: c.id, dots: dots.get(c.id) ?? 0 }))
    return { archetypeId, cases: cs, dots: cs.reduce((s, c) => s + c.dots, 0) }
  })
  const byArchetype = rankWithTies(rows, (r) => r.dots).map((r) => ({ ...r.item, rank: r.rank }))
  const totalDots = [...dots.values()].reduce((s, n) => s + n, 0)
  return { byCase, byArchetype, totalDots, voters: voters.size, maxCaseDots: Math.max(0, ...dots.values()) }
}

/** Dots a person has placed. */
export const dotsUsed = (votes: readonly Vote[], userId: string): number =>
  votes.filter((v) => v.userId === userId).length
