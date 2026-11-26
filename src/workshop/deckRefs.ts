/** The parts of the card deck the workshop engine needs, as plain ids. */
import { archetypes, cards, getCard } from '../data/deck'
import type { CaseRef } from './tally'

export const ARCHETYPE_IDS: readonly string[] = archetypes.map((a) => a.id)

/** All 28 case cards in deck order. */
export const CASE_REFS: readonly CaseRef[] = cards
  .filter((c) => c.type === 'case')
  .map((c) => ({ id: c.id, archetypeId: c.archetypeId! }))

const CASE_IDS = new Set(CASE_REFS.map((c) => c.id))
export const isCaseCard = (id: string) => CASE_IDS.has(id)

export const cardArchetype = (cardId: string): string | null => getCard(cardId)?.archetypeId ?? null

/** Cards a group reads in Inspirations-Modus 1, in order: archetype → technology + organisation → 4 cases. */
export function readingOrder(archetypeId: string): { overview: string[]; properties: string[]; cases: string[] } {
  const own = cards.filter((c) => c.archetypeId === archetypeId)
  const ids = (t: string) => own.filter((c) => c.type === t).map((c) => c.id)
  return { overview: ids('archetype'), properties: [...ids('technology'), ...ids('organisation')], cases: ids('case') }
}
