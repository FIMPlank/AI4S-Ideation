import { describe, expect, it } from 'vitest'
import { href, parseHash, roomHref } from './router'

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
    ['#/spielmodi', { name: 'landing', section: 'spielmodi' }],
    ['#/forschung', { name: 'landing', section: 'forschung' }],
    ['#/forschung/x', { name: 'notFound' }],
    ['#/impressum', { name: 'impressum' }],
    ['#/datenschutz', { name: 'datenschutz' }],
    ['#/gibtsnicht', { name: 'notFound' }],
    ['#/karte', { name: 'notFound' }],
    ['#/raum', { name: 'roomHome' }],
    ['#/raum/neu', { name: 'roomNew' }],
    ['#/raum/neu/x', { name: 'notFound' }],
    ['#/raum/abc234', { name: 'room', code: 'ABC234', view: 'teilnehmer' }],
    ['#/raum/ABC234/moderation', { name: 'room', code: 'ABC234', view: 'moderation' }],
    ['#/raum/ABC234/leinwand', { name: 'room', code: 'ABC234', view: 'leinwand' }],
    ['#/raum/ABC234/ergebnis', { name: 'room', code: 'ABC234', view: 'ergebnis' }],
    ['#/raum/ABC234/teilnehmer', { name: 'notFound' }],
    ['#/raum/ABC234/x', { name: 'notFound' }],
    ['#/raum/ABC234/leinwand/x', { name: 'notFound' }],
    ['#/raum/Demo/moderation', { name: 'room', code: 'demo', view: 'moderation' }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash).route).toEqual(route)
  })
  it('keeps the facilitator secret in the query', () => {
    expect(parseHash('#/raum/ABC234/moderation?schluessel=xyz').params.get('schluessel')).toBe('xyz')
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

describe('roomHref', () => {
  it('builds room links', () => {
    expect(roomHref('ABC234')).toBe('#/raum/ABC234')
    expect(roomHref('ABC234', 'leinwand')).toBe('#/raum/ABC234/leinwand')
  })
})
