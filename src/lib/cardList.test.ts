import { describe, expect, it } from 'vitest'
import { getCard } from '../data/deck'
import { filterFromParams, resolveList } from './cardList'

describe('resolveList', () => {
  it('defaults to the card’s own archetype', () => {
    const l = resolveList(new URLSearchParams(), getCard('a2-organisation'))
    expect(l.cards.map((c) => c.id)).toEqual([
      'a2-archetype',
      'a2-technology',
      'a2-organisation',
      'a2-activation',
      'a2-case-1',
      'a2-case-2',
      'a2-case-3',
      'a2-case-4',
    ])
    expect(l.backHref).toBe('#/archetyp/a2')
  })
  it('rebuilds a filtered list from the URL', () => {
    const l = resolveList(new URLSearchParams('liste=filter&typ=activation'))
    expect(l.cards).toHaveLength(7)
    expect(l.backHref).toBe('#/karten?typ=activation')
  })
  it('ignores unknown filter values', () => {
    expect(filterFromParams(new URLSearchParams('typ=foo,archetype&sdg=1,13'))).toEqual({
      types: ['archetype'],
      sdgs: [13],
      query: '',
    })
  })
})
