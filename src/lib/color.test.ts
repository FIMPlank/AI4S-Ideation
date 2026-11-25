import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { archetypes } from '../data/deck'
import { SDGS } from '../data/sdgs'
import { AA, archetypeSurface, contrast, textOn } from './color'

const tokensCss = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8')
function token(name: string): string {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token --${name} missing`)
  return m[1].toLowerCase()
}

describe('textOn', () => {
  it('keeps AA contrast on every SDG colour', () => {
    for (const s of Object.values(SDGS)) expect(contrast(s.color, textOn(s.color))).toBeGreaterThanOrEqual(AA)
  })
})

describe('archetype colours', () => {
  it('tokens --a1…--a7 match archetypes[].colour in cards.json', () => {
    for (const a of archetypes) expect(token(a.id)).toBe(a.colour.toLowerCase())
  })
  it('text on every archetype colour passes AA, with the README pairing', () => {
    const fg = archetypes.map((a) => {
      const s = archetypeSurface(a.colour)
      expect(contrast(s.bg, s.fg)).toBeGreaterThanOrEqual(AA)
      return s.fg === '#ffffff' ? 'white' : 'ink'
    })
    // README: white on a2, a3, a4 (a4 darkened), ink on a1, a5, a6, a7
    expect(fg).toEqual(['ink', 'white', 'white', 'white', 'ink', 'ink', 'ink'])
    expect(archetypeSurface(archetypes[3].colour).bg).not.toBe(archetypes[3].colour.toLowerCase())
  })
})

describe('landing text/background pairs (WCAG AA)', () => {
  // [text token, background token, minimum ratio]; large/bold display text still held to 4.5 where possible
  const pairs: [string, string][] = [
    ['ink', 'white'],
    ['body', 'white'],
    ['muted', 'white'],
    ['green-text', 'white'],
    ['navy', 'white'],
    ['ink', 'mist'],
    ['body', 'mist'],
    ['muted', 'mist'],
    ['green-text', 'mist'],
    ['navy', 'mist'],
    ['white', 'navy'],
    ['on-navy', 'navy'],
    ['lime-on-navy', 'navy'],
    ['ink', 'yellow'],
    ['white', 'footer'],
    ['on-navy', 'footer'],
    ['body', 'mist'],
  ]
  it.each(pairs)('%s on %s', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(AA)
  })
})
