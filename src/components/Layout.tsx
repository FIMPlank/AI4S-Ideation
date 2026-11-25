import type { ReactNode } from 'react'
import { t } from '../i18n/de'
import type { Route } from '../lib/router'
import { Footer } from './Footer'
import { LogoMark } from './landing/LogoMark'

/** Workshop flows don't exist yet: "Workshop starten" opens the workshop preparation in the Leitfaden. */
export const WORKSHOP_HREF = '#/leitfaden/vorbereitung'

const NAV: { href: string; label: string; current: (r: Route) => boolean }[] = [
  { href: '#/karten', label: t.site.navCards, current: (r) => ['deck', 'archetype', 'card'].includes(r.name) },
  { href: '#/spielmodi', label: t.site.navModes, current: (r) => r.name === 'landing' && r.section === 'spielmodi' },
  { href: '#/leitfaden', label: t.site.navGuide, current: (r) => r.name === 'leitfaden' },
  { href: '#/forschung', label: t.site.navResearch, current: (r) => r.name === 'landing' && r.section === 'forschung' },
]

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        {t.site.skip}
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <a href="#/" className="brand">
            <LogoMark />
            <span className="brand__text">
              <span className="brand__name">{t.site.brand}</span>
              <span className="brand__sub">{t.site.publisher}</span>
            </span>
          </a>
          <nav aria-label={t.site.mainNav} className="main-nav">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} aria-current={n.current(route) ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
            <a className="lbtn lbtn--primary lbtn--nav" href={WORKSHOP_HREF}>
              {t.site.ctaWorkshop}
            </a>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  )
}
