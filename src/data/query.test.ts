import { describe, expect, it } from 'vitest'
import { buildIndex, drawRandom, filterCards, normalize, searchCards } from './query'
import type { Archetype, Card } from './types'

const img = { full: '', thumb: '' }
const base = { images: { front: img, back: img }, pages: { front: 1, back: 2 } }

const archetypes: Archetype[] = [
  { id: 'a1', number: 1, title: 'Nachhaltigkeitsangaben überprüfen', colour: '#EF7C00', sdgs: [12, 13] },
  { id: 'a2', number: 2, title: 'Strukturierte Daten erfassen', colour: '#BA1153', sdgs: [9] },
]

const cards: Card[] = [
  {
    ...base,
    id: 'g1',
    type: 'guide',
    archetypeId: null,
    mode: 'inspiration-1',
    title: 'Inspirations-Modus 1',
    steps: [{ text: 'Sie liest:', subItems: ['Überblickskarte'] }],
    what: 'Skizzen neuer Ideen',
    when: 'Ideation-Phase',
  },
  {
    ...base,
    id: 'a1-archetype',
    type: 'archetype',
    archetypeId: 'a1',
    title: 'Nachhaltigkeitsangaben überprüfen',
    intro: 'Natural Language Processing für Maßnahmen',
    points: [],
    sustainabilityLink: 'Größtes Potenzial',
  },
  {
    ...base,
    id: 'a1-case-1',
    type: 'case',
    archetypeId: 'a1',
    title: 'Accern',
    summary: 'Datenlücken schließen',
    takeaways: { technology: 'Low-Code-Plattform', organisation: 'Nicht-Techniker:innen', sustainability: 'ESG' },
  },
  {
    ...base,
    id: 'a2-activation',
    type: 'activation',
    archetypeId: 'a2',
    title: 'Aktivierungsfrage',
    question: 'Wie könnte Computer Vision helfen?',
    caseOverview: ['Steinert trennt Materialien'],
  },
  {
    ...base,
    id: 'a2-case-4',
    type: 'case',
    archetypeId: 'a2',
    title: 'Brammibal‘s Donuts',
    summary: 'Prognosen',
    takeaways: { technology: 'x', organisation: 'y', sustainability: 'z' },
  },
]
const index = buildIndex(cards, archetypes)
const ids = (cs: Card[]) => cs.map((c) => c.id)

describe('normalize', () => {
  it('folds case, umlauts, ß and diacritics', () => {
    expect(normalize('MAẞNAHMEN Größe Überprüfen Café')).toBe('massnahmen grosse uberprufen cafe')
  })
  it('unifies typographic quotes and dashes', () => {
    expect(normalize('Brammibal‘s – Donut')).toBe("brammibal's - donut")
  })
})

describe('filterCards', () => {
  it('returns every card in deck order without criteria', () => {
    expect(ids(filterCards(index, {}))).toEqual(ids(cards))
  })
  it('filters by one or more card types', () => {
    expect(ids(filterCards(index, { types: ['case'] }))).toEqual(['a1-case-1', 'a2-case-4'])
    expect(ids(filterCards(index, { types: ['guide', 'activation'] }))).toEqual(['g1', 'a2-activation'])
  })
  it('matches SDGs through the archetype; guides have none', () => {
    expect(ids(filterCards(index, { sdgs: [13] }))).toEqual(['a1-archetype', 'a1-case-1'])
    expect(ids(filterCards(index, { sdgs: [9, 12] }))).toEqual([
      'a1-archetype',
      'a1-case-1',
      'a2-activation',
      'a2-case-4',
    ])
    expect(ids(filterCards(index, { sdgs: [16] }))).toEqual([])
  })
  it('combines type, SDG and text criteria with AND', () => {
    expect(ids(filterCards(index, { types: ['case'], sdgs: [9], query: 'donut' }))).toEqual(['a2-case-4'])
    expect(ids(filterCards(index, { types: ['archetype'], query: 'donut' }))).toEqual([])
  })
})

describe('searchCards', () => {
  it('ignores case and diacritics on both sides', () => {
    expect(ids(searchCards(index, 'UBERPRUFEN'))).toEqual(['a1-archetype', 'a1-case-1'])
    expect(ids(searchCards(index, 'überprüfen'))).toEqual(['a1-archetype', 'a1-case-1'])
    expect(ids(searchCards(index, 'massnahmen'))).toEqual(['a1-archetype'])
    expect(ids(searchCards(index, 'Maßnahmen'))).toEqual(['a1-archetype'])
    expect(ids(searchCards(index, 'grosstes'))).toEqual(['a1-archetype'])
  })
  it('searches every text field: steps, sub-items, what/when, takeaways, overview, archetype title', () => {
    expect(ids(searchCards(index, 'uberblickskarte'))).toEqual(['g1'])
    expect(ids(searchCards(index, 'skizzen'))).toEqual(['g1'])
    expect(ids(searchCards(index, 'low-code'))).toEqual(['a1-case-1'])
    expect(ids(searchCards(index, 'steinert'))).toEqual(['a2-activation'])
    expect(ids(searchCards(index, 'strukturierte'))).toEqual(['a2-activation', 'a2-case-4'])
  })
  it('does not match image paths, ids or types', () => {
    expect(searchCards(index, 'activation')).toEqual([])
    expect(searchCards(index, 'a1')).toEqual([])
  })
  it('requires every word to match', () => {
    expect(ids(searchCards(index, 'computer vision'))).toEqual(['a2-activation'])
    expect(ids(searchCards(index, 'computer donut'))).toEqual([])
  })
  it('treats typographic and straight apostrophes alike', () => {
    expect(ids(searchCards(index, "brammibal's"))).toEqual(['a2-case-4'])
  })
  it('returns everything for a blank query', () => {
    expect(searchCards(index, '   ')).toHaveLength(cards.length)
  })
})

describe('drawRandom', () => {
  const pool = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
  it('maps the rng value onto the pool', () => {
    expect(drawRandom(pool, () => 0)?.id).toBe('x')
    expect(drawRandom(pool, () => 0.5)?.id).toBe('y')
    expect(drawRandom(pool, () => 0.999)?.id).toBe('z')
  })
  it('never exceeds the pool even if rng returns 1', () => {
    expect(drawRandom(pool, () => 1)?.id).toBe('z')
  })
  it('does not repeat the excluded card', () => {
    for (let i = 0; i < 50; i++) expect(drawRandom(pool, Math.random, 'y')?.id).not.toBe('y')
  })
  it('still returns the only card when it is excluded', () => {
    expect(drawRandom([{ id: 'x' }], Math.random, 'x')?.id).toBe('x')
  })
  it('returns undefined for an empty pool', () => {
    expect(drawRandom([], () => 0)).toBeUndefined()
  })
  it('reaches every card over many draws', () => {
    const seen = new Set<string>()
    let seed = 42
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 100; i++) seen.add(drawRandom(pool, rng)!.id)
    expect([...seen].sort()).toEqual(['x', 'y', 'z'])
  })
})
