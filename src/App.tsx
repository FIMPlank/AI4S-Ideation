import { useEffect, useRef } from 'react'
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
import { Legal } from './pages/Legal'
import { NotFound } from './pages/NotFound'

const SITE = t.site.name

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
    case 'impressum':
      return `${t.legal.impressum} · ${SITE}`
    case 'datenschutz':
      return `${t.legal.privacy} · ${SITE}`
    default:
      return `${t.titles.notFound} · ${SITE}`
  }
}

/** Identity of a "page" for focus/scroll: query changes (filters, prev/next lists) don't count. */
function pageKey(route: Route): string {
  return route.name + ('id' in route ? `/${route.id}` : '')
}

export function App() {
  const { route, params } = useLocation()
  const key = pageKey(route)
  const first = useRef(true)

  useEffect(() => {
    document.title = titleFor(route)
  }, [route])

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
    // move focus to the new page so screen readers announce it
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    }
  }, [key])

  return (
    <Layout route={route}>
      <Page route={route} params={params} />
    </Layout>
  )
}

function Page({ route, params }: { route: Route; params: URLSearchParams }) {
  switch (route.name) {
    case 'landing':
      return <Landing />
    case 'deck':
      return <Deck params={params} />
    case 'archetype':
      return <ArchetypePage id={route.id} />
    case 'card':
      return <CardViewer id={route.id} params={params} />
    case 'draw':
      return <Draw params={params} />
    case 'impressum':
    case 'datenschutz':
      return <Legal kind={route.name} />
    default:
      return <NotFound />
  }
}
