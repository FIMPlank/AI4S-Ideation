import { useEffect, type CSSProperties } from 'react'
import { CardImage } from '../components/CardImage'
import { WORKSHOP_HREF } from '../components/Layout'
import { Tile } from '../components/Tile'
import { DrawBand } from '../components/landing/DrawBand'
import { BENEFIT_TILES, HERO_TILES, MODE_TILES } from '../components/landing/tiles'
import { MODES } from '../config/modes'
import { miroverseUrl } from '../config/site'
import { firstList, leitfaden, sectionById } from '../content/leitfaden'
import { archetypes, cards, cardsByArchetype, getCard, guideCards } from '../data/deck'
import { SDGS } from '../data/sdgs'
import type { Card } from '../data/types'
import { t } from '../i18n/de'
import { asset, PDF_PATH } from '../lib/assets'
import { doiUrl, joinAuthors, shortCitation, shortJournal } from '../lib/citation'
import type { LandingSection } from '../lib/router'
import { useReducedMotion } from '../lib/useReducedMotion'

const l = t.landing
const paper = leitfaden.meta.paper
const pad2 = (n: number) => String(n).padStart(2, '0')

const archetypeCard = (id: string): Card => cardsByArchetype(id)[0]
const caseCount = cards.filter((c) => c.type === 'case').length
const perDeck = cardsByArchetype(archetypes[0].id).length

/** Cover headline with the soft hyphen and the two coloured words. */
function Headline({ id }: { id: string }) {
  const [word, hyphenated] = l.hyphenate
  const text = leitfaden.meta.cover.headline.replace(word, hyphenated)
  const { navy, green } = l.highlight
  const parts = text.split(new RegExp(`(${navy}|${green})`))
  return (
    <h1 id={id} className="l-h1">
      {parts.map((p, i) =>
        p === navy ? (
          <span key={i} className="is-navy">
            {p}
          </span>
        ) : p === green ? (
          <span key={i} className="is-green">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </h1>
  )
}

function Hero() {
  const research = l.researchLine(shortCitation(paper), shortJournal(paper.journal))
  // a2 left, a5 right, a3 on top in the centre (reference order)
  const fan: { id: string; cls: string }[] = [
    { id: 'a2', cls: 'hero-fan__card--left' },
    { id: 'a5', cls: 'hero-fan__card--right' },
    { id: 'a3', cls: 'hero-fan__card--centre' },
  ]
  return (
    <section className="l-container hero" aria-labelledby="h-hero">
      <div className="hero__text">
        <p className="hero__eyebrow">
          <span className="hero__dots" aria-hidden="true">
            <span />
            <span />
          </span>
          {l.eyebrow(leitfaden.meta.cover.subline)}
        </p>
        <Headline id="h-hero" />
        <p className="hero__lead">{l.lead(archetypes.length, caseCount, MODES.length)}</p>
        <div className="l-ctas">
          <a className="lbtn lbtn--primary lbtn--lg" href="#/karten">
            {l.ctaExplore}
          </a>
          <a className="lbtn lbtn--outline lbtn--lg" href={WORKSHOP_HREF}>
            {l.ctaWorkshop}
          </a>
          <a className="l-textlink l-textlink--lg" href="#/ziehen">
            {l.ctaDraw}
          </a>
        </div>
        <p className="hero__research">
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z" />
            <path d="M8 7h7" />
          </svg>
          <a href="#/forschung">
            {research.before}
            <em>{research.journal}</em>
          </a>
        </p>
      </div>
      <div className="hero-fan">
        <div className="mosaic" aria-hidden="true">
          {HERO_TILES.map((tile, i) => (
            <Tile key={i} {...tile} />
          ))}
        </div>
        {fan.map((f) => (
          <CardImage
            key={f.id}
            card={archetypeCard(f.id)}
            size="full"
            sizes="(min-width: 1000px) 190px, 38vw"
            className={`hero-fan__card ${f.cls}`}
            eager
            priority={f.id === 'a3'}
          />
        ))}
      </div>
    </section>
  )
}

function Stats() {
  const stats: [number, string][] = [
    [cards.length, l.stats.cards],
    [archetypes.length, l.stats.archetypes],
    [caseCount, l.stats.cases],
    [MODES.length, l.stats.modes],
  ]
  return (
    <section className="l-container" aria-label={l.statsLabel}>
      <ul className="stats">
        {stats.map(([n, label]) => (
          <li key={label} className="stats__item">
            <span className="stats__num">{n}</span> <span className="stats__label">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Archetypes() {
  return (
    <section className="l-container l-section l-section--archetypes" aria-labelledby="h-archetypes">
      <div className="l-head l-head--split">
        <div className="l-head__title">
          <p className="l-eyebrow">{l.archetypesEyebrow}</p>
          <h2 id="h-archetypes" className="l-h2">
            {l.archetypesTitle}
          </h2>
        </div>
        <p className="l-head__lead">{l.archetypesLead(perDeck)}</p>
      </div>
      <ul className="arch-row">
        {archetypes.map((a) => (
          <li key={a.id}>
            <a className="arch-row__link lift" href={`#/archetyp/${a.id}`}>
              <CardImage card={archetypeCard(a.id)} decorative className="arch-row__img" />
              <span className="arch-row__num">{l.archetypeLabel(a.number)}</span>
              <span className="arch-row__title" lang="de">
                {a.title}
              </span>
              <span className="arch-row__sdgs">
                <span className="visually-hidden">{l.sdgs}: </span>
                {a.sdgs.map((id) => (
                  <span key={id} className="sdg-dot" style={{ '--sdg': SDGS[id].color } as CSSProperties}>
                    SDG {id}
                  </span>
                ))}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Anatomy() {
  const tech = getCard('a1-technology')
  const kase = getCard('a3-case-1')
  return (
    <section className="l-container l-section--tail" aria-labelledby="h-anatomy">
      <div className="l-anatomy">
        <div className="l-anatomy__cards">
          {tech && (
            <CardImage
              card={tech}
              side="back"
              sizes="(min-width: 1000px) 260px, 45vw"
              className="l-anatomy__card l-anatomy__card--a"
            />
          )}
          {kase && (
            <CardImage
              card={kase}
              side="back"
              sizes="(min-width: 1000px) 260px, 45vw"
              className="l-anatomy__card l-anatomy__card--b"
            />
          )}
        </div>
        <div className="l-anatomy__text">
          <p className="l-eyebrow">{l.anatomyEyebrow}</p>
          <h2 id="h-anatomy" className="l-h3-panel">
            {l.anatomyTitle}
          </h2>
          <ol className="l-steps">
            {l.anatomy.map((s, i) => (
              <li key={s.label}>
                <span className="l-steps__num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong>{s.label}</strong> – {s.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Modes() {
  const guides = guideCards()
  return (
    <section id="spielmodi" className="l-container l-section" aria-labelledby="h-modes">
      <div className="l-head">
        <p className="l-eyebrow">{l.modesEyebrow}</p>
        <h2 id="h-modes" className="l-h2" tabIndex={-1}>
          {l.modesTitle}
        </h2>
        <p className="l-head__lead">{l.modesLead}</p>
      </div>
      <ul className="modes">
        {MODES.map((m, i) => {
          const card = guides.find((g) => g.mode === m.cardMode)
          return (
            <li key={m.id} className="mode-tile">
              <div className="mode-tile__top">
                <Tile {...MODE_TILES[i % MODE_TILES.length]} className="icon-tile icon-tile--52" />
                {/* decorative number drawn via CSS content, so it isn't read or contrast-checked as text */}
                <span className="mode-tile__ghost" data-n={pad2(i + 1)} aria-hidden="true" />
              </div>
              <h3 className="l-h3 l-h3--lg">{m.name}</h3>
              <p className="mode-tile__text">{l.modeText[m.id]}</p>
              {card && (
                <>
                  <dl className="mode-tile__facts">
                    <div>
                      <dt>{l.modeWhat}</dt>
                      <dd>{card.what}</dd>
                    </div>
                    <div>
                      <dt>{l.modeWhen}</dt>
                      <dd>{card.when}</dd>
                    </div>
                  </dl>
                  <a className="mode-tile__card" href={`#/karte/${card.id}?liste=anleitung`}>
                    {l.modeCard}
                    <span className="visually-hidden">: {m.name}</span>
                  </a>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="l-ctas">
        <a className="lbtn lbtn--primary lbtn--lg" href={WORKSHOP_HREF}>
          {l.ctaWorkshop}
        </a>
        <a className="lbtn lbtn--outline lbtn--lg" href="#/leitfaden">
          {l.ctaGuide}
        </a>
      </div>
    </section>
  )
}

function Why() {
  const labels = firstList(sectionById('kernvorteile')).map((it) => it.label ?? '')
  return (
    <section className="band-mist" aria-labelledby="h-why">
      <div className="l-container l-section">
        <div className="l-head l-head--split">
          <div className="l-head__title">
            <p className="l-eyebrow">{l.whyEyebrow}</p>
            <h2 id="h-why" className="l-h2">
              {l.whyTitle}
            </h2>
          </div>
          <a className="l-textlink l-textlink--lg l-textlink--flush" href="#/leitfaden/motivation">
            {l.whyMore}
          </a>
        </div>
        <ul className="benefit-grid">
          {labels.map((label, i) => (
            <li key={label} className="benefit-tile">
              <Tile {...BENEFIT_TILES[i % BENEFIT_TILES.length]} className="icon-tile icon-tile--56" />
              <h3 className="l-h3 l-h3--sm">{label}</h3>
              <p>{l.benefits[i]}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Channels() {
  return (
    <section className="l-container l-section" aria-labelledby="h-channels">
      <div className="l-head">
        <p className="l-eyebrow">{l.channelsEyebrow}</p>
        <h2 id="h-channels" className="l-h2">
          {l.channelsTitle}
        </h2>
      </div>
      <ul className="channels">
        <li className="channel channel--navy">
          <div className="channel__head">
            <h3 className="l-h3">{l.liveTitle}</h3>
          </div>
          <p>{l.liveText}</p>
          {/* live rooms come with the Supabase phase: no link until then */}
          <span className="soon-pill soon-pill--yellow">
            {l.liveCta} · {l.soon.toLowerCase()}
          </span>
        </li>
        <li className="channel">
          <div className="channel__head">
            <h3 className="l-h3">{l.printTitle}</h3>
          </div>
          <p>{l.printText(cards.length)}</p>
          <a className="lbtn lbtn--outline" href={asset(PDF_PATH)} download>
            {l.printCta}
            <span className="visually-hidden"> ({l.printMeta})</span>
          </a>
        </li>
        <li className="channel">
          <div className="channel__head">
            <h3 className="l-h3">{l.miroTitle}</h3>
            {!miroverseUrl && <span className="soon-badge">{l.soon}</span>}
          </div>
          <p>{l.miroText}</p>
          {miroverseUrl && (
            <a className="lbtn lbtn--outline" href={miroverseUrl} rel="noopener">
              {l.miroCta}
            </a>
          )}
        </li>
      </ul>
    </section>
  )
}

function Research() {
  return (
    <section id="forschung" className="l-container l-section--tail" aria-labelledby="h-research">
      <div className="l-research">
        <div className="l-research__bar" aria-hidden="true">
          {archetypes.map((a) => (
            <span key={a.id} style={{ background: a.colour }} />
          ))}
        </div>
        <div className="l-research__inner">
          <div className="l-research__text">
            <p className="l-eyebrow">{l.researchEyebrow}</p>
            <h2 id="h-research" className="l-h2 l-h2--panel" tabIndex={-1}>
              {l.researchTitle}
            </h2>
            <p>{l.researchText}</p>
          </div>
          <figure className="cite">
            <p className="cite__authors">
              {joinAuthors(paper.authors)} ({paper.year})
            </p>
            <blockquote className="cite__title" lang="en">
              {paper.title}
            </blockquote>
            <figcaption className="cite__journal">
              <span lang="en">{t.leitfaden.citationJournal(paper.journal, paper.volume, paper.pages)}</span>
            </figcaption>
            <div className="l-ctas l-ctas--tight">
              <a className="lbtn lbtn--primary" href={paper.url} rel="noopener">
                {l.paperLink}
              </a>
              <a className="l-textlink" href={doiUrl(paper.doi)} rel="noopener">
                {l.doi(paper.doi)}
              </a>
            </div>
          </figure>
        </div>
      </div>
    </section>
  )
}

export function Landing({ section }: { section?: LandingSection }) {
  const reduced = useReducedMotion()
  // deep links #/spielmodi and #/forschung
  useEffect(() => {
    if (!section) return
    const el = document.getElementById(section)
    if (!el) return
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return (
    <div className="landing">
      <Hero />
      <Stats />
      <Archetypes />
      <Anatomy />
      <DrawBand />
      <Modes />
      <Why />
      <Channels />
      <Research />
    </div>
  )
}
