import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CardImage } from '../components/CardImage'
import { activationCards, archetypes, cardsByArchetype, getArchetype, getCard } from '../data/deck'
import { drawRandom } from '../data/query'
import { t } from '../i18n/de'
import { textOn } from '../lib/color'
import { href, navigate } from '../lib/router'
import { useReducedMotion } from '../lib/useReducedMotion'

const SHUFFLE_MS = 1100
/** The seven archetype covers, one per colour, make up the shuffled pile. */
const pile = () => archetypes.map((a) => cardsByArchetype(a.id)[0])

export function Draw({ params }: { params: URLSearchParams }) {
  const reduced = useReducedMotion()
  const found = getCard(params.get('karte') ?? '')
  const current = found?.type === 'activation' ? found : undefined
  const [shuffling, setShuffling] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const d = t.draw

  function draw() {
    const picked = drawRandom(activationCards(), Math.random, current?.id)
    if (!picked) return
    const show = () => navigate(href('/ziehen', { karte: picked.id }), { replace: true })
    window.clearTimeout(timer.current)
    if (reduced) return show()
    setShuffling(true)
    timer.current = window.setTimeout(() => {
      setShuffling(false)
      show()
    }, SHUFFLE_MS)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (current && !shuffling) headingRef.current?.focus({ preventScroll: true })
  }, [current, shuffling])

  const archetype = current ? getArchetype(current.archetypeId) : undefined

  return (
    <div className="container section draw">
      <h1>{d.title}</h1>
      <p className="lead">{d.lead}</p>

      <div className="draw__table">
        {shuffling || !current || !archetype ? (
          <div className={`draw__deck${shuffling ? ' is-shuffling' : ''}`} aria-hidden="true">
            {pile().map((c, i) => (
              <span key={c.id} className="draw__back" style={{ '--i': i } as CSSProperties}>
                <CardImage card={c} decorative eager />
              </span>
            ))}
          </div>
        ) : (
          <article
            key={current.id}
            className="draw__card"
            style={{ background: archetype.colour, color: textOn(archetype.colour) }}
            aria-labelledby="draw-q"
          >
            <p className="draw__label">{d.label(archetype.number)}</p>
            <h2 id="draw-q" ref={headingRef} tabIndex={-1} className="draw__q">
              {current.question}
            </h2>
            <p className="draw__arche">{archetype.title}</p>
          </article>
        )}
        <output className="visually-hidden">
          {shuffling ? d.shuffling : current ? d.drawn(current.question) : ''}
        </output>
      </div>

      <div className="cta-row cta-row--center">
        <button type="button" className="btn btn--primary" onClick={draw} disabled={shuffling}>
          {current ? d.again : d.draw}
        </button>
        {current && archetype && !shuffling && (
          <>
            <a className="btn" href={`#/archetyp/${archetype.id}`}>
              {d.toArchetype}
            </a>
            <a className="btn btn--ghost" href={href(`/karte/${current.id}`, { liste: archetype.id })}>
              {d.viewCard}
            </a>
          </>
        )}
      </div>
    </div>
  )
}
