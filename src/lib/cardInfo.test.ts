import { describe, expect, it } from 'vitest'
import { getCard } from '../data/deck'
import { displayTitle, fullLabel } from './cardInfo'

describe('card labels', () => {
  it('uses the question as the title of activation cards', () => {
    expect(displayTitle(getCard('a1-activation')!)).toMatch(/^Welche Nachhaltigkeitsberichte/)
  })
  it('names the archetype on property cards', () => {
    expect(fullLabel(getCard('a2-technology')!)).toMatch(/^Technologie \(Archetyp 2: /)
    expect(fullLabel(getCard('a1-case-1')!)).toBe('Fallbeispiel: AWS')
  })
})
