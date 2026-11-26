import { CRITERIA, type Criterion, type Rating, type Selection } from './types'

export interface Stat {
  n: number
  mean: number | null
  min: number | null
  max: number | null
  /** Population standard deviation. */
  sd: number | null
}

export function stat(values: readonly number[]): Stat {
  const n = values.length
  if (!n) return { n: 0, mean: null, min: null, max: null, sd: null }
  const mean = values.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  return { n, mean, min: Math.min(...values), max: Math.max(...values), sd }
}

export type RatingSummary = Record<Criterion, Stat> & { raters: number }

/** Mean and spread per criterion for one selection. */
export function summarizeRatings(ratings: readonly Rating[], selectionId: string): RatingSummary {
  const mine = ratings.filter((r) => r.selectionId === selectionId && r.score >= 1 && r.score <= 5)
  const out = { raters: new Set(mine.map((r) => r.userId)).size } as RatingSummary
  for (const c of CRITERIA) out[c] = stat(mine.filter((r) => r.criterion === c).map((r) => r.score))
  return out
}

export interface MatrixPoint {
  selectionId: string
  /** Umsetzbarkeit, 1–5 */
  x: number
  /** Geschäftsnutzen, 1–5 */
  y: number
  /** Nachhaltigkeitswirkung, 1–5: bubble size and colour intensity */
  size: number
  raters: number
}

/** One bubble per strategy item that has a mean on all three criteria. */
export function matrixPoints(selections: readonly Selection[], ratings: readonly Rating[]): MatrixPoint[] {
  return selections
    .filter((s) => s.kind === 'strategy_target')
    .sort((a, b) => a.position - b.position)
    .flatMap((s) => {
      const sum = summarizeRatings(ratings, s.id)
      const { umsetzbarkeit: x, geschaeftsnutzen: y, nachhaltigkeit: z } = sum
      if (x.mean === null || y.mean === null || z.mean === null) return []
      return [{ selectionId: s.id, x: x.mean, y: y.mean, size: z.mean, raters: sum.raters }]
    })
}

/** Bubble radius for a 1–5 value, between rMin and rMax (area grows linearly). */
export const bubbleRadius = (value: number, rMin = 10, rMax = 34): number => {
  const t = Math.min(1, Math.max(0, (value - 1) / 4))
  return Math.sqrt(rMin ** 2 + t * (rMax ** 2 - rMin ** 2))
}

/** Has this person rated every criterion of every strategy item? */
export function hasRatedAll(ratings: readonly Rating[], selections: readonly Selection[], userId: string): boolean {
  const targets = selections.filter((s) => s.kind === 'strategy_target')
  if (!targets.length) return false
  const mine = new Set(ratings.filter((r) => r.userId === userId).map((r) => `${r.selectionId}:${r.criterion}`))
  return targets.every((s) => CRITERIA.every((c) => mine.has(`${s.id}:${c}`)))
}
