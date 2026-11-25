import { describe, expect, it } from 'vitest'
import { guideCards } from '../data/deck'
import { MODES, modeForCard } from './modes'

describe('mode names', () => {
  it('follows the card order: Inspirations-Modus 1 → 2 → Strategie', () => {
    expect(MODES.map((m) => m.id)).toEqual(['inspiration-1', 'inspiration-2', 'strategie'])
  })
  it('maps every printed guide card to exactly one mode with the printed name', () => {
    for (const g of guideCards()) expect(modeForCard(g.mode).name).toBe(g.title)
    expect(new Set(MODES.map((m) => m.cardMode)).size).toBe(3)
  })
})
