import { modeForCard } from '../config/modes'
import { getArchetype } from '../data/deck'
import type { Card } from '../data/types'
import { t } from '../i18n/de'

/** Type label as printed on the card front ("Fallbeispiel", "Aktivierungsfrage", ...). */
export const typeLabel = (card: Card) => t.cardTypes[card.type].one

/** Main title of a card: the question for activation cards, the name otherwise. */
export function displayTitle(card: Card): string {
  if (card.type === 'activation') return card.question
  if (card.type === 'guide') return modeForCard(card.mode).name
  return card.title
}

/** For guide cards whose printed name differs from the brochure name: "Karte: Inspirations-Modus 2". */
export function printedHint(card: Card): string | undefined {
  if (card.type !== 'guide') return undefined
  const m = modeForCard(card.mode)
  return m.printedName !== m.name ? t.modes.printedHint(m.printedName) : undefined
}

/** Short title for pager buttons and grid captions. */
export function shortTitle(card: Card): string {
  return card.type === 'case' || card.type === 'guide' ? displayTitle(card) : typeLabel(card)
}

/** Self-contained label, e.g. "Fallbeispiel: AWS" or "Technologie (Archetyp 1)". Used for alt text and sharing. */
export function fullLabel(card: Card): string {
  const a = getArchetype(card.archetypeId)
  switch (card.type) {
    case 'technology':
    case 'organisation':
      return a ? `${card.title} (${t.deck.archetype(a.number)}: ${a.title})` : card.title
    default:
      return `${typeLabel(card)}: ${displayTitle(card)}`
  }
}
