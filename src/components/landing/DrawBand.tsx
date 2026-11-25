import { useState } from 'react'
import { activationCards, getArchetype } from '../../data/deck'
import { t } from '../../i18n/de'
import { archetypeSurface } from '../../lib/color'
import { pickDifferent } from '../../lib/draw'

const questions = activationCards()
  .map((card) => ({ card, archetype: getArchetype(card.archetypeId)! }))
  .sort((a, b) => a.archetype.number - b.archetype.number)

/** Archetype 5 first, as in the design reference (deterministic first paint). */
const START = Math.max(
  0,
  questions.findIndex((q) => q.archetype.number === 5),
)

/** "Ziehen Sie eine Karte." band: draws a random activation question in the archetype's colour. */
export function DrawBand() {
  const l = t.landing
  const [index, setIndex] = useState(START)
  const [draws, setDraws] = useState(0)
  const { card, archetype } = questions[index]
  const surface = archetypeSurface(archetype.colour)

  const draw = () => {
    setIndex((i) => pickDifferent(questions.length, i))
    setDraws((d) => d + 1)
  }

  return (
    <section className="band-draw" aria-labelledby="h-draw">
      <div className="l-container band-draw__inner">
        <div className="band-draw__text">
          <p className="l-eyebrow l-eyebrow--on-navy">{l.drawEyebrow}</p>
          <h2 id="h-draw" className="l-h2 l-h2--band">
            {l.drawTitle}
          </h2>
          <p className="band-draw__lead">{l.drawLead}</p>
          <div className="l-ctas">
            <button type="button" className="lbtn lbtn--yellow" onClick={draw}>
              {l.drawButton}
            </button>
            <a className="l-textlink l-textlink--on-navy" href={`#/archetyp/${archetype.id}`}>
              {l.toArchetype(archetype.number)}
            </a>
          </div>
        </div>
        <div className="band-draw__card">
          <div className="qstack">
            <div className="qstack__ghost qstack__ghost--1" aria-hidden="true" />
            <div className="qstack__ghost qstack__ghost--2" aria-hidden="true" />
            <div
              className="qcard"
              aria-live="polite"
              aria-atomic="true"
              style={{ background: surface.bg, color: surface.fg }}
            >
              <span className="qcard__deco qcard__deco--circle" aria-hidden="true" />
              <span className="qcard__deco qcard__deco--leaf" aria-hidden="true" />
              <span className="qcard__title">{card.title}</span>
              <span key={draws} className="qcard__q">
                {card.question}
              </span>
            </div>
          </div>
          <p className="band-draw__caption">{l.drawCaption(archetype.number, archetype.title)}</p>
        </div>
      </div>
    </section>
  )
}
