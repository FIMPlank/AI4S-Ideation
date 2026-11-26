import { lazy, Suspense, useEffect, useRef } from 'react'
import { Layout } from './components/Layout'
import { getArchetype, getCard } from './data/deck'
import { t } from './i18n/de'
import { fullLabel } from './lib/cardInfo'
import { useLocation, type Route } from './lib/router'
import { ArchetypePage } from './pages/ArchetypePage'
import { CardViewer } from './pages/CardViewer'
import { Deck } from './pages/Deck'
import { Draw } from './pages/Draw'
import { Landing } from './pages/Landing'
import { Leitfaden } from './pages/Leitfaden'
import { Legal } from './pages/Legal'
import { NotFound } from './pages/NotFound'

// the Live-Raum (and supabase-js, qrcode) loads only on #/raum routes
const RoomApp = lazy(() => import('./room/RoomApp'))

const SITE = t.site.name
const DEFAULT_DESCRIPTION = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''

function setMetaDescription(text: string) {
  document.querySelector('meta[name="description"]')?.setAttribute('content', text)
}

function titleFor(route: Route): string {
  switch (route.name) {
    case 'landing':
      return SITE
    case 'deck':
      return `${t.titles.deck} · ${SITE}`
    case 'archetype': {
      const a = getArchetype(route.id)
      return `${a ? `${t.deck.archetype(a.number)}: ${a.title}` : t.deck.guideDeck} · ${SITE}`
    }
    case 'card': {
      const c = getCard(route.id)
      return `${c ? fullLabel(c) : t.titles.notFound} · ${SITE}`
    }
    case 'draw':
      return `${t.titles.draw} · ${SITE}`
    case 'leitfaden':
      return `${t.titles.leitfaden} · ${SITE}`
    case 'impressum':
      return `${t.legal.impressum} · ${SITE}`
    case 'datenschutz':
      return `${t.legal.privacy} · ${SITE}`
    case 'roomHome':
    case 'roomNew':
      return `${t.room.title} · ${SITE}`
    case 'room':
      return `${t.room.title} ${route.code === 'demo' ? t.room.home.demoTitle : route.code} · ${SITE}`
    default:
      return `${t.titles.notFound} · ${SITE}`
  }
}

/** Identity of a "page" for focus/scroll: query changes (filters, prev/next lists) don't count. */
function pageKey(route: Route): string {
  if (route.name === 'room') return `room/${route.code}/${route.view}`
  return route.name + ('id' in route ? `/${route.id}` : '')
}

export function App() {
  const { route, params } = useLocation()
  const key = pageKey(route)
  const first = useRef(true)
  const deepSection = route.name === 'leitfaden' || route.name === 'landing' ? route.section : undefined

  useEffect(() => {
    document.title = titleFor(route)
    setMetaDescription(route.name === 'leitfaden' ? t.leitfaden.metaDescription : DEFAULT_DESCRIPTION)
  }, [route])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    // a Leitfaden or landing deep link scrolls to its own section
    if (deepSection) return
    window.scrollTo(0, 0)
    // move focus to the new page so screen readers announce it
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    }
  }, [key, deepSection])

  // room screens (phone, console, projector) are full-screen, without the site chrome
  if (route.name === 'room')
    return (
      <Suspense fallback={null}>
        <RoomApp route={route} params={params} />
      </Suspense>
    )

  return (
    <Layout route={route}>
      <Page route={route} params={params} />
    </Layout>
  )
}

function Page({ route, params }: { route: Route; params: URLSearchParams }) {
  switch (route.name) {
    case 'landing':
      return <Landing section={route.section} />
    case 'deck':
      return <Deck params={params} />
    case 'archetype':
      return <ArchetypePage id={route.id} />
    case 'card':
      return <CardViewer id={route.id} params={params} />
    case 'draw':
      return <Draw params={params} />
    case 'leitfaden':
      return <Leitfaden section={route.section} />
    case 'impressum':
    case 'datenschutz':
      return <Legal kind={route.name} />
    case 'roomHome':
    case 'roomNew':
      return (
        <Suspense fallback={null}>
          <RoomApp route={route} params={params} />
        </Suspense>
      )
    default:
      return <NotFound />
  }
}
