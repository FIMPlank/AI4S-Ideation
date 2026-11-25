import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { activationCards, archetypes, cards, cardsByArchetype, findCards, getCard, guideCards } from './deck'
import { CARD_TYPES, SDG_IDS } from './types'

describe('deck data (cards.json)', () => {
  it('has 59 cards: 3 guides and 7 archetypes × 8 in the documented order', () => {
    expect(cards).toHaveLength(59)
    expect(guideCards().map((g) => g.mode)).toEqual(['inspiration-1', 'inspiration-2', 'strategy'])
    expect(archetypes).toHaveLength(7)
    for (const a of archetypes) {
      expect(cardsByArchetype(a.id).map((c) => c.type)).toEqual([
        'archetype',
        'technology',
        'organisation',
        'activation',
        'case',
        'case',
        'case',
        'case',
      ])
    }
    expect(activationCards()).toHaveLength(7)
  })
  it('uses unique ids, known types, known SDGs and #RRGGBB colours', () => {
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
    for (const c of cards) {
      expect(CARD_TYPES).toContain(c.type)
      expect(getCard(c.id)).toBe(c)
    }
    for (const a of archetypes) {
      expect(a.colour).toMatch(/^#[0-9a-f]{6}$/i)
      for (const s of a.sdgs) expect(SDG_IDS).toContain(s)
    }
  })
  it('points every card at image files that exist', () => {
    const paths = cards.flatMap((c) => [c.images.front, c.images.back]).flatMap((s) => [s.full, s.thumb])
    expect(paths).toHaveLength(59 * 4)
    expect(paths.filter((p) => !existsSync(resolve('public', p)))).toEqual([])
  })
  it('finds real cards with German, diacritics-insensitive search', () => {
    expect(findCards({ query: 'brammibal' }).map((c) => c.id)).toEqual(['a4-activation', 'a4-case-4'])
    expect(findCards({ query: 'BRAMMIBAL’S', types: ['case'] }).map((c) => c.id)).toEqual(['a4-case-4'])
    const viaUmlaut = findCards({ query: 'überwachte' }).map((c) => c.id)
    expect(viaUmlaut.length).toBeGreaterThan(0)
    expect(findCards({ query: 'uberwachte' }).map((c) => c.id)).toEqual(viaUmlaut)
  })
})
