import type { ReactNode } from 'react'
import { t } from '../i18n/de'
import type { Route } from '../lib/router'
import { Footer } from './Footer'

const NAV: { href: string; label: string; match: Route['name'][] }[] = [
  { href: '#/karten', label: t.site.navCards, match: ['deck', 'archetype', 'card'] },
  { href: '#/ziehen', label: t.site.navDraw, match: ['draw'] },
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
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 32 32">
              <rect
                x="7"
                y="4"
                width="18"
                height="24"
                rx="3"
                fill="currentColor"
                opacity=".35"
                transform="rotate(-10 16 16)"
              />
              <rect x="7" y="4" width="18" height="24" rx="3" fill="currentColor" transform="rotate(8 16 16)" />
            </svg>
            <span className="brand__text">
              {t.site.brand} <span className="brand__sub">{t.site.brandSub}</span>
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
