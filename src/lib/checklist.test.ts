import { describe, expect, it } from 'vitest'
import { CHECKLIST_KEY, doneCount, loadChecklist, saveChecklist, toggle } from './checklist'
import type { KeyValueStore } from './storage'

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const broken: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('checklist state', () => {
  it('toggles items on and off without mutating', () => {
    const a = {}
    const b = toggle(a, 'kartenset')
    expect(b).toEqual({ kartenset: true })
    expect(a).toEqual({})
    expect(toggle(b, 'kartenset')).toEqual({})
  })
  it('counts ticked items', () => {
    expect(doneCount({ a: true, c: true }, ['a', 'b', 'c'])).toBe(2)
  })
  it('round-trips through storage', () => {
    const s = memory()
    expect(saveChecklist({ material: true }, s)).toBe(true)
    expect(loadChecklist(['material', 'kartenset'], s)).toEqual({ material: true })
  })
  it('drops unknown ids and non-true values', () => {
    const s = memory()
    s.data.set(CHECKLIST_KEY, JSON.stringify({ material: true, alt: true, kartenset: 'yes' }))
    expect(loadChecklist(['material', 'kartenset'], s)).toEqual({ material: true })
  })
  it('survives broken JSON and blocked storage', () => {
    const s = memory()
    s.data.set(CHECKLIST_KEY, '{not json')
    expect(loadChecklist(['a'], s)).toEqual({})
    expect(loadChecklist(['a'], broken)).toEqual({})
    expect(saveChecklist({ a: true }, broken)).toBe(false)
  })
})
