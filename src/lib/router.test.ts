import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router'

describe('parseHash', () => {
  it.each([
    ['', { name: 'landing' }],
    ['#/', { name: 'landing' }],
    ['#/karten', { name: 'deck' }],
    ['#/archetyp/a3', { name: 'archetype', id: 'a3' }],
    ['#/karte/a1-2', { name: 'card', id: 'a1-2' }],
    ['#/ziehen', { name: 'draw' }],
    ['#/leitfaden', { name: 'leitfaden' }],
    ['#/leitfaden/hintergrund', { name: 'leitfaden', section: 'hintergrund' }],
    ['#/impressum', { name: 'impressum' }],
    ['#/datenschutz', { name: 'datenschutz' }],
    ['#/gibtsnicht', { name: 'notFound' }],
    ['#/karte', { name: 'notFound' }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash).route).toEqual(route)
  })
  it('reads query params', () => {
    expect(parseHash('#/karte/a1-1?liste=a1').params.get('liste')).toBe('a1')
  })
})

describe('href', () => {
  it('drops empty params', () => {
    expect(href('/karten', { q: 'ki', typ: '' })).toBe('#/karten?q=ki')
    expect(href('/')).toBe('#/')
  })
})
