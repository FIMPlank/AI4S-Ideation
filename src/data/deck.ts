import raw from './cards.json'
import { buildIndex, filterCards, type CardFilter } from './query'
import type { ActivationCard, Archetype, Card, Deck, GuideCard } from './types'

/** cards.json is generated; its order is the printed deck order. */
export const deck = raw as unknown as Deck

export const archetypes: Archetype[] = [...deck.archetypes].sort((a, b) => a.number - b.number)
export const cards: Card[] = deck.cards

const cardById = new Map(cards.map((c) => [c.id, c]))
const archetypeById = new Map(archetypes.map((a) => [a.id, a]))
const index = buildIndex(cards, archetypes)

/** Pseudo-archetype id used for the instruction deck in routes. */
export const GUIDE_DECK_ID = 'anleitung'
/** Neutral colour for the instruction deck (not an archetype colour). */
export const GUIDE_COLOUR = '#1d3a44'

export const getCard = (id: string): Card | undefined => cardById.get(id)
export const getArchetype = (id: string | null | undefined): Archetype | undefined =>
  id ? archetypeById.get(id) : undefined

/** Cards of one archetype (or of the instruction deck, id "anleitung") in deck order. */
export function cardsByArchetype(id: string): Card[] {
  if (id === GUIDE_DECK_ID) return cards.filter((c) => c.type === 'guide')
  return cards.filter((c) => c.archetypeId === id)
}

export const guideCards = (): GuideCard[] => cards.filter((c): c is GuideCard => c.type === 'guide')
export const activationCards = (): ActivationCard[] => cards.filter((c): c is ActivationCard => c.type === 'activation')

export const findCards = (filter: CardFilter): Card[] => filterCards(index, filter)

export const colourOf = (card: Card): string => getArchetype(card.archetypeId)?.colour ?? GUIDE_COLOUR
