import type { Archetype, Card, CardType, SdgId } from './types'

/**
 * Folds German text for matching: lower case, ß → ss, diacritics removed
 * (ä → a, é → e), typographic quotes/dashes unified, whitespace collapsed.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚‛`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Keys that hold data, not card text. */
const NON_TEXT_KEYS = new Set(['id', 'type', 'archetypeId', 'mode', 'images', 'pages'])

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out)
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (!NON_TEXT_KEYS.has(k)) collectStrings(v, out)
}

/** Every text field on a card (whatever its type), plus its archetype's title. */
export function cardText(card: Card, archetype?: Archetype): string {
  const parts: string[] = []
  collectStrings(card, parts)
  if (archetype) parts.push(archetype.title)
  return parts.join('\n')
}

/** Cards carry no SDGs of their own; they inherit their archetype's. */
export const cardSdgs = (archetype?: Archetype): SdgId[] => archetype?.sdgs ?? []

export interface CardFilter {
  /** Empty = all types. */
  types?: CardType[]
  /** Empty = any SDG. A card matches if its archetype has at least one of them. */
  sdgs?: SdgId[]
  /** Free text; every word must occur somewhere on the card. */
  query?: string
}

export interface Searchable {
  card: Card
  archetype?: Archetype
  text: string
}

/** Precompute normalized text once per card. */
export function buildIndex(cards: Card[], archetypes: Archetype[], extraText?: (c: Card) => string): Searchable[] {
  const byId = new Map(archetypes.map((a) => [a.id, a]))
  return cards.map((card) => {
    const archetype = card.archetypeId ? byId.get(card.archetypeId) : undefined
    return { card, archetype, text: normalize(cardText(card, archetype) + '\n' + (extraText?.(card) ?? '')) }
  })
}

export function matchesQuery(entry: Searchable, query: string): boolean {
  const terms = normalize(query).split(' ').filter(Boolean)
  return terms.every((t) => entry.text.includes(t))
}

/** Cards matching every given criterion, in input (deck) order. */
export function filterCards(index: Searchable[], filter: CardFilter): Card[] {
  const types = filter.types ?? []
  const sdgs = filter.sdgs ?? []
  const query = filter.query?.trim() ?? ''
  return index
    .filter((e) => types.length === 0 || types.includes(e.card.type))
    .filter((e) => sdgs.length === 0 || cardSdgs(e.archetype).some((s) => sdgs.includes(s)))
    .filter((e) => query === '' || matchesQuery(e, query))
    .map((e) => e.card)
}

/** Free-text search only. */
export function searchCards(index: Searchable[], query: string): Card[] {
  return filterCards(index, { query })
}

/**
 * Picks a random item. When `excludeId` is given and the pool has another
 * option, that item is never returned twice in a row.
 */
export function drawRandom<T extends { id: string }>(
  pool: readonly T[],
  rng: () => number = Math.random,
  excludeId?: string,
): T | undefined {
  const candidates = pool.length > 1 && excludeId ? pool.filter((c) => c.id !== excludeId) : pool
  if (candidates.length === 0) return undefined
  const i = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
  return candidates[i]
}
