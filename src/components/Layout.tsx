import type { ReactNode } from 'react'
import { t } from '../i18n/de'
import type { Route } from '../lib/router'
import { Footer } from './Footer'

const NAV: { href: string; label: string; match: Route['name'][] }[] = [
  { href: '#/karten', label: t.site.navCards, match: ['deck', 'archetype', 'card'] },
  { href: '#/ziehen', label: t.site.navDraw, match: ['draw'] },
  { href: '#/leitfaden', label: t.site.navGuide, match: ['leitfaden'] },
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
        <div className="container site-header__inner">
          <a href="#/" className="brand">
            <svg className="brand__mark" aria-hidden="true" width="34" height="34" viewBox="0 0 36 36">
              {/* three fanned mini cards in archetype colours */}
              <rect x="10" y="6" width="16" height="23" rx="2.5" fill="#008198" transform="rotate(-18 18 30)" />
              <rect x="10" y="6" width="16" height="23" rx="2.5" fill="#FBB900" transform="rotate(0 18 30)" />
              <rect x="10" y="6" width="16" height="23" rx="2.5" fill="#EF7C00" transform="rotate(18 18 30)" />
              <path
                d="M18 12.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
                fill="#fff"
                transform="rotate(18 18 30)"
              />
            </svg>
            <span className="brand__text">
              <span className="brand__kicker">{t.site.brandKicker}</span>
              <span className="brand__name">{t.site.brand}</span>
            </span>
          </a>
          <nav aria-label={t.site.mainNav}>
            <ul className="main-nav">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} aria-current={n.match.includes(route.name) ? 'page' : undefined}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
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
