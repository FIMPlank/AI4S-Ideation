import { describe, expect, it } from 'vitest'
import { SDGS } from '../data/sdgs'
import { contrast, textOn } from './color'

describe('textOn', () => {
  it('keeps AA contrast on every SDG colour', () => {
    for (const s of Object.values(SDGS)) expect(contrast(s.color, textOn(s.color))).toBeGreaterThanOrEqual(4.5)
  })
})
