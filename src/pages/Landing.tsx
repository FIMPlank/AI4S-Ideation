import type { CSSProperties } from 'react'
import { CardImage } from '../components/CardImage'
import { Benefits } from '../components/leitfaden/Benefits'
import { ResearchBadge } from '../components/leitfaden/CitationCard'
import { ModeCards } from '../components/leitfaden/ModeCards'
import { firstList, leitfaden, sectionById } from '../content/leitfaden'
import { archetypes, cardsByArchetype } from '../data/deck'
import { t } from '../i18n/de'
import { asset, PDF_PATH } from '../lib/assets'
import { textOn } from '../lib/color'
import { replayShuffle } from '../lib/replayShuffle'

export function Landing() {
  const l = t.landing
  const heroCards = [3, 1, 0, 2, 4].map((i) => cardsByArchetype(archetypes[i].id)[0])
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__text">
            <p className="eyebrow">{l.eyebrow}</p>
            <h1>{leitfaden.meta.cover.headline}</h1>
            <p className="hero__subline">{leitfaden.meta.cover.subline}</p>
            <p className="lead">{l.lead}</p>
            <div className="cta-row">
              <a className="btn btn--primary" href="#/karten">
                {l.ctaExplore}
              </a>
              <a className="btn btn--accent" href="#/ziehen">
                {l.ctaDraw}
              </a>
              <a className="btn" href={asset(PDF_PATH)} download>
                {l.ctaPdf}
                <span className="visually-hidden"> ({l.ctaPdfMeta})</span>
              </a>
              <button type="button" className="btn btn--disabled" disabled>
                {l.ctaWorkshop} <span className="badge">{l.soon}</span>
              </button>
            </div>
          </div>
          <div className="hero__fan" aria-hidden="true" onPointerEnter={replayShuffle}>
            {heroCards.map((c, i) => (
              <span key={c.id} className="hero__card" style={{ '--i': i - 2 } as CSSProperties}>
                <CardImage card={c} decorative eager={i === 2} />
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="why" aria-labelledby="h-why">
        <div className="container section">
          <h2 id="h-why">{l.whyTitle}</h2>
          <Benefits items={firstList(sectionById('kernvorteile'))} headingLevel={3} />
          <p className="why__links">
            <a className="btn btn--small" href="#/leitfaden">
              {l.whyMore}
            </a>
            <a href="#/leitfaden/hintergrund" className="research-link">
              <ResearchBadge />
              <span>{l.research}</span>
            </a>
          </p>
        </div>
      </section>

      <section className="container section" aria-labelledby="h-archetypes">
        <h2 id="h-archetypes">{l.archetypesTitle}</h2>
        <ol className="archetype-list">
          {archetypes.map((a) => (
            <li key={a.id}>
              <a href={`#/archetyp/${a.id}`} style={{ background: a.colour, color: textOn(a.colour) }}>
                <span className="archetype-list__num" aria-hidden="true">
                  {a.number}
                </span>
                <span className="visually-hidden">{t.deck.archetype(a.number)}: </span>
                {a.title}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="container section" aria-labelledby="h-modes">
        <h2 id="h-modes">{l.modesTitle}</h2>
        <p>{l.modesLead}</p>
        <ModeCards headingLevel={3} />
      </section>

      <section className="container section about" aria-labelledby="h-about">
        <h2 id="h-about">{l.aboutTitle}</h2>
        <p>{l.about}</p>
      </section>
    </>
  )
}
