import { CardGrid } from '../components/CardGrid'
import { SdgList } from '../components/SdgChip'
import { archetypes, cardsByArchetype, getArchetype, GUIDE_COLOUR, GUIDE_DECK_ID } from '../data/deck'
import { t } from '../i18n/de'
import { textOn } from '../lib/color'
import { NotFound } from './NotFound'

export function ArchetypePage({ id }: { id: string }) {
  const a = getArchetype(id)
  if (!a && id !== GUIDE_DECK_ID) return <NotFound />
  const s = t.archetype
  const colour = a?.colour ?? GUIDE_COLOUR
  const idx = a ? archetypes.indexOf(a) : -1
  const prev = idx > 0 ? archetypes[idx - 1] : undefined
  const next = idx >= 0 && idx < archetypes.length - 1 ? archetypes[idx + 1] : undefined

  return (
    <>
      <section className="arche-hero" style={{ background: colour, color: textOn(colour) }}>
        <div className="container">
          <p className="eyebrow">
            <a href="#/karten">{s.crumb}</a> / {a ? t.deck.archetype(a.number) : t.deck.guideDeck}
          </p>
          <h1>{a ? a.title : s.guideTitle}</h1>
        </div>
      </section>
      <div className="container section">
        {a ? (
          <>
            <h2>{s.howTitle}</h2>
            <ol className="flow" style={{ '--deck': a.colour } as React.CSSProperties}>
              {s.steps.map((step) => (
                <li key={step.label}>
                  <span className="flow__n" aria-hidden="true">
                    {step.n}
                  </span>
                  <span>
                    <strong>{step.label}</strong>
                    <span className="visually-hidden"> ({s.cardNo(step.n)})</span>
                    <span className="flow__text">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <SdgList ids={a.sdgs} label={s.sdgs} />
          </>
        ) : (
          <p className="lead">{s.guideLead}</p>
        )}
        <h2>{a ? s.cardsTitle : s.guideCardsTitle}</h2>
        <CardGrid cards={cardsByArchetype(id)} listParams={{ liste: id }} />
        {a && (
          <nav className="pager" aria-label={s.pager}>
            {prev ? <a href={`#/archetyp/${prev.id}`}>← {t.deck.archetype(prev.number)}</a> : <span />}
            {next ? <a href={`#/archetyp/${next.id}`}>{t.deck.archetype(next.number)} →</a> : <span />}
          </nav>
        )}
      </div>
    </>
  )
}
