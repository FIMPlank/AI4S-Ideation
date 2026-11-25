import { describe, expect, it } from 'vitest'
import { pickDifferent } from './draw'

describe('pickDifferent', () => {
  it('never returns the current index', () => {
    for (let cur = 0; cur < 7; cur++) {
      for (let k = 0; k < 50; k++) {
        const r = k / 50
        const n = pickDifferent(7, cur, () => r)
        expect(n).not.toBe(cur)
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThan(7)
      }
    }
  })
  it('reaches every other index', () => {
    const seen = new Set<number>()
    for (let k = 0; k < 6; k++) seen.add(pickDifferent(7, 3, () => k / 6))
    expect([...seen].sort()).toEqual([0, 1, 2, 4, 5, 6])
  })
  it('handles a single item', () => {
    expect(pickDifferent(1, 0)).toBe(0)
  })
})
