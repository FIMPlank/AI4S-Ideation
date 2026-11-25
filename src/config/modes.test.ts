import { describe, expect, it } from 'vitest'
import { guideCards } from '../data/deck'
import { LEGACY_MODE_IDS, MODES, modeForCard } from './modes'

describe('mode names', () => {
  it('follows the brochure order: Inspiration → Ideation → Strategie', () => {
    expect(MODES.map((m) => m.id)).toEqual(['inspiration', 'ideation', 'strategie'])
  })
  it('maps every printed guide card to exactly one mode and keeps its printed name', () => {
    for (const g of guideCards()) expect(modeForCard(g.mode).printedName).toBe(g.title)
    expect(new Set(MODES.map((m) => m.cardMode)).size).toBe(3)
  })
  it('maps old card-numbered ids to the new route ids', () => {
    expect(LEGACY_MODE_IDS['inspiration-2']).toBe('inspiration')
    expect(LEGACY_MODE_IDS['inspiration-1']).toBe('ideation')
  })
})
