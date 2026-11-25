import { cards, cardsByArchetype, findCards, getArchetype, GUIDE_DECK_ID } from '../data/deck'
import type { CardFilter } from '../data/query'
import { CARD_TYPES, SDG_IDS, type Card, type CardType, type SdgId } from '../data/types'
import { t } from '../i18n/de'
import { href } from './router'

/** Reads the deck-overview filter from URL params (typ, sdg, q). */
export function filterFromParams(p: URLSearchParams): CardFilter {
  const list = (k: string) => (p.get(k) ?? '').split(',').filter(Boolean)
  return {
    types: list('typ').filter((t): t is CardType => (CARD_TYPES as readonly string[]).includes(t)),
    sdgs: list('sdg')
      .map(Number)
      .filter((n): n is SdgId => (SDG_IDS as readonly number[]).includes(n)),
    query: p.get('q') ?? '',
  }
}

export function filterToParams(f: CardFilter): Record<string, string | undefined> {
  return {
    typ: f.types?.join(','),
    sdg: f.sdgs?.join(','),
    q: f.query?.trim() || undefined,
  }
}

export const isFiltered = (f: CardFilter) =>
  (f.types?.length ?? 0) > 0 || (f.sdgs?.length ?? 0) > 0 || (f.query?.trim() ?? '') !== ''

export interface CardList {
  cards: Card[]
  /** Short name of the list, shown in the viewer ("Archetyp 3", "Suchergebnis"). */
  label: string
  backHref: string
  /** Params to keep on prev/next links so the list survives navigation. */
  params: Record<string, string | undefined>
}

/**
 * The list a card is browsed in. `liste` is an archetype id, "anleitung",
 * "filter" (with typ/sdg/q) or "alle". Falls back to the card's own archetype.
 */
export function resolveList(params: URLSearchParams, current?: Card): CardList {
  const liste = params.get('liste')
  if (liste === 'filter') {
    const f = filterFromParams(params)
    const p = filterToParams(f)
    return { cards: findCards(f), label: t.viewer.listFiltered, backHref: href('/karten', p), params: { liste, ...p } }
  }
  if (liste === 'alle') {
    return { cards, label: t.viewer.listAll, backHref: href('/karten'), params: { liste } }
  }
  const deckId = liste ?? current?.archetypeId ?? GUIDE_DECK_ID
  const arche = getArchetype(deckId)
  if (arche || deckId === GUIDE_DECK_ID) {
    return {
      cards: cardsByArchetype(deckId),
      label: arche ? t.deck.archetype(arche.number) : t.deck.guideDeck,
      backHref: href(`/archetyp/${deckId}`),
      params: { liste: deckId },
    }
  }
  return { cards, label: t.viewer.listAll, backHref: href('/karten'), params: { liste: 'alle' } }
}
