/** Results carried from one mode to the next in a full workshop. */
import { tallyVotes, type CaseRef } from './tally'
import type { Idea, RoomSnapshot, Selection } from './types'

const byPosition = (a: Selection, b: Selection) => a.position - b.position

/**
 * Archetypes prioritised in Inspirations-Modus 2: the ones the facilitator marked
 * "relevant" (in that order); if none were marked, all with dots, by dots.
 * Needs revealed votes to fall back on the ranking.
 */
export function prioritisedArchetypes(
  snap: RoomSnapshot,
  cases: readonly CaseRef[],
  archetypeIds: readonly string[],
): string[] {
  const marked = snap.selections
    .filter((s) => s.kind === 'relevant_archetype')
    .sort(byPosition)
    .map((s) => s.refId)
  if (marked.length) return marked
  return tallyVotes(snap.votes, cases, archetypeIds)
    .byArchetype.filter((a) => a.dots > 0)
    .map((a) => a.archetypeId)
}

export interface StrategyCandidates {
  archetypes: string[]
  /** Case cards with dots, best first (max 5). */
  topCases: string[]
  ideas: Idea[]
}

/** What the Strategie-Modus can pick from, besides "any card". */
export function strategyCandidates(
  snap: RoomSnapshot,
  cases: readonly CaseRef[],
  archetypeIds: readonly string[],
): StrategyCandidates {
  const tally = tallyVotes(snap.votes, cases, archetypeIds)
  return {
    archetypes: prioritisedArchetypes(snap, cases, archetypeIds),
    topCases: tally.byCase
      .filter((c) => c.dots > 0)
      .slice(0, 5)
      .map((c) => c.cardId),
    ideas: [...snap.ideas].sort((a, b) => a.groupNo - b.groupNo || a.updatedAt - b.updatedAt),
  }
}

/**
 * Archetype a strategy item belongs to (for its technology/organisation cards).
 * `cardArchetype` maps a card id to its archetype; ideas use their group's draw,
 * or the archetype of the case they were inspired by.
 */
export function archetypeOfSelection(
  sel: Pick<Selection, 'refType' | 'refId'>,
  snap: Pick<RoomSnapshot, 'ideas' | 'draws'>,
  cardArchetype: (cardId: string) => string | null,
): string | null {
  if (sel.refType === 'archetype') return sel.refId
  if (sel.refType === 'card') return cardArchetype(sel.refId)
  const idea = snap.ideas.find((i) => i.id === sel.refId)
  if (!idea) return null
  const draw = snap.draws.find((d) => d.groupNo === idea.groupNo)
  return draw?.archetypeId ?? (idea.inspiredBy ? cardArchetype(idea.inspiredBy) : null)
}
