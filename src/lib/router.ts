import { useEffect, useState } from 'react'

/** Sections of the landing page that have their own deep link (#/spielmodi). */
export const LANDING_SECTIONS = ['spielmodi', 'forschung'] as const
export type LandingSection = (typeof LANDING_SECTIONS)[number]

export type Route =
  /** section scrolls the landing page; not part of the page identity */
  | { name: 'landing'; section?: LandingSection }
  | { name: 'deck' }
  | { name: 'archetype'; id: string }
  | { name: 'card'; id: string }
  | { name: 'draw' }
  /** section is a heading id from leitfaden.de.md; not part of the page identity */
  | { name: 'leitfaden'; section?: string }
  | { name: 'impressum' }
  | { name: 'datenschutz' }
  | { name: 'notFound' }

export interface Location {
  route: Route
  params: URLSearchParams
}

/** Parses "#/karte/a1-3?liste=a1" into a route and its query string. */
export function parseHash(hash: string): Location {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  const params = new URLSearchParams(search)
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const route = matchRoute(parts)
  return { route, params }
}

function matchRoute(parts: string[]): Route {
  const [head, id, ...rest] = parts
  if (rest.length > 0) return { name: 'notFound' }
  switch (head) {
    case undefined:
      return { name: 'landing' }
    case 'karten':
      return id ? { name: 'notFound' } : { name: 'deck' }
    case 'archetyp':
      return id ? { name: 'archetype', id } : { name: 'notFound' }
    case 'karte':
      return id ? { name: 'card', id } : { name: 'notFound' }
    case 'leitfaden':
      return id ? { name: 'leitfaden', section: id } : { name: 'leitfaden' }
    case 'ziehen':
      return id ? { name: 'notFound' } : { name: 'draw' }
    case 'spielmodi':
    case 'forschung':
      return id ? { name: 'notFound' } : { name: 'landing', section: head }
    case 'impressum':
      return { name: 'impressum' }
    case 'datenschutz':
      return { name: 'datenschutz' }
    default:
      return { name: 'notFound' }
  }
}

/** Builds an href like "#/karte/a1-3?liste=a1"; empty params are dropped. */
export function href(path: string, params?: Record<string, string | undefined> | URLSearchParams): string {
  const sp = params instanceof URLSearchParams ? new URLSearchParams(params) : new URLSearchParams()
  if (params && !(params instanceof URLSearchParams)) {
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  }
  const qs = sp.toString()
  return `#${path}${qs ? `?${qs}` : ''}`
}

export function navigate(to: string, { replace = false } = {}): void {
  if (replace) {
    history.replaceState(null, '', to)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = to.replace(/^#/, '')
  }
}

export function useLocation(): Location {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const on = () => setLoc(parseHash(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return loc
}

/** Absolute URL of a hash route, for sharing. */
export function absoluteUrl(hashHref: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}${hashHref}`
}
