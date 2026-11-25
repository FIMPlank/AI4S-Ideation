import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Benefits } from '../components/leitfaden/Benefits'
import { CardSetOverview } from '../components/leitfaden/CardSetOverview'
import { CitationCard } from '../components/leitfaden/CitationCard'
import { ModeCards } from '../components/leitfaden/ModeCards'
import { Item, Prose } from '../components/leitfaden/Prose'
import { ResourceChecklist } from '../components/leitfaden/ResourceChecklist'
import { BROCHURE_PDF_PATH, brochurePdfPublic } from '../config/site'
import { firstList, leitfaden, paragraphs } from '../content/leitfaden'
import type { Section } from '../content/parse'
import { t } from '../i18n/de'
import { asset } from '../lib/assets'
import { useReducedMotion } from '../lib/useReducedMotion'

const { meta, sections } = leitfaden
/** Brochure "#" is an h2 here: the page title is the only h1. */
const headingTag = (s: Section) => `h${s.level + 1}` as 'h2' | 'h3' | 'h4'
const tocSections = sections.filter((s) => s.level <= 2)

/** Section bodies that get more than plain prose. Text always comes from the brochure. */
function SectionBody({ s }: { s: Section }): ReactNode {
  const sub = s.level + 2
  switch (s.id) {
    case 'kernvorteile': {
      const intro = paragraphs(s)
      return (
        <>
          <Prose blocks={intro} />
          <Benefits items={firstList(s)} headingLevel={Math.min(sub, 5) as 3 | 4 | 5} />
        </>
      )
    }
    case 'hintergrund':
      // the brochure's "Hier geht es zum Paper" link (a QR code in print) becomes the citation card
      return (
        <>
          {s.blocks.map((b, i) =>
            b.kind === 'p' && b.linkOnly === meta.paper.url ? (
              <CitationCard key={i} paper={meta.paper} />
            ) : (
              <Prose key={i} blocks={[b]} />
            ),
          )}
        </>
      )
    case 'kartenset':
      return (
        <>
          <Prose blocks={s.blocks} />
          <CardSetOverview />
        </>
      )
    case 'vorbereitung': {
      const ps = paragraphs(s)
      if (ps.length !== t.leitfaden.phases.length) return <Prose blocks={s.blocks} />
      return (
        <ol className="timeline" aria-label={t.leitfaden.phasesLabel}>
          {ps.map((p, i) => (
            <li key={i}>
              <span className="timeline__n" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h4 className="timeline__title">{t.leitfaden.phases[i]}</h4>
                <p dangerouslySetInnerHTML={{ __html: p.html }} />
              </div>
            </li>
          ))}
        </ol>
      )
    }
    case 'ressourcen':
      return (
        <>
          <Prose blocks={paragraphs(s)} />
          <ResourceChecklist items={firstList(s)} />
        </>
      )
    case 'allgemeine-vorbereitung':
      return (
        <ol className="steps" aria-label={t.leitfaden.stepsLabel}>
          {firstList(s).map((it, i) => (
            <li key={i}>
              <span className="steps__n" aria-hidden="true">
                {i + 1}
              </span>
              <p>
                <Item item={it} />
              </p>
            </li>
          ))}
        </ol>
      )
    case 'spielmodi':
      return (
        <>
          <Prose blocks={s.blocks} />
          <ModeCards headingLevel={3} />
        </>
      )
    default:
      return <Prose blocks={s.blocks} />
  }
}

/** The id of the last section heading above the top fifth of the viewport. */
function useCurrentSection(): string {
  const [current, setCurrent] = useState(sections[0].id)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const line = window.innerHeight * 0.2
      let id = sections[0].id
      for (const s of tocSections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= line) id = s.id
      }
      setCurrent(id)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
  return current
}

function Toc({ current, onNavigate }: { current: string; onNavigate: (id: string) => void }) {
  const l = t.leitfaden
  return (
    <nav aria-label={l.tocLabel}>
      <ol className="toc">
        {tocSections.map((s) => (
          <li key={s.id} className={`toc__item toc__item--${s.level}`}>
            <a
              href={`#/leitfaden/${s.id}`}
              aria-current={current === s.id ? 'location' : undefined}
              onClick={() => onNavigate(s.id)}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function Leitfaden({ section }: { section?: string }) {
  const l = t.leitfaden
  const reduced = useReducedMotion()
  const current = useCurrentSection()
  const mobileToc = useRef<HTMLDetailsElement>(null)

  function goTo(id: string, smooth: boolean) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'auto', block: 'start' })
    el.querySelector<HTMLElement>('h2, h3, h4')?.focus({ preventScroll: true })
  }

  // deep links (#/leitfaden/hintergrund) and TOC clicks
  useEffect(() => {
    if (section) goTo(section, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const onNavigate = (id: string) => {
    if (mobileToc.current) mobileToc.current.open = false
    // same hash twice fires no hashchange, so scroll here too
    if (id === section) goTo(id, true)
  }

  return (
    <div className="container section leitfaden">
      <header className="leitfaden__head">
        <p className="eyebrow">
          {t.site.navGuide}
          {meta.status === 'konzept' && <span className="badge badge--concept">{l.concept}</span>}
        </p>
        <h1>{meta.title}</h1>
        {meta.status === 'konzept' && <p className="leitfaden__note">{l.conceptNote}</p>}
        <p className="cta-row no-print">
          <button type="button" className="btn btn--small" onClick={() => window.print()}>
            {l.print}
          </button>
          {brochurePdfPublic && (
            <a className="btn btn--small" href={asset(BROCHURE_PDF_PATH)} download>
              {l.brochurePdf}
            </a>
          )}
        </p>
      </header>

      <div className="leitfaden__layout">
        <aside className="leitfaden__toc no-print">
          <details className="toc-mobile" ref={mobileToc}>
            <summary>{l.toc}</summary>
            <Toc current={current} onNavigate={onNavigate} />
          </details>
          <div className="toc-desktop">
            <p className="toc-desktop__title" aria-hidden="true">
              {l.toc}
            </p>
            <Toc current={current} onNavigate={onNavigate} />
          </div>
        </aside>

        <div className="leitfaden__content prose">
          {sections.map((s) => {
            const H = headingTag(s)
            return (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`h-${s.id}`}
                className={`lf-section lf-section--${s.level}`}
              >
                <H id={`h-${s.id}`} tabIndex={-1}>
                  {s.title}
                </H>
                <SectionBody s={s} />
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
