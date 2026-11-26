import { useEffect, useId, useRef, useState } from 'react'
import { CardImage } from '../../components/CardImage'
import { CardText } from '../../components/CardText'
import { FlipCard } from '../../components/FlipCard'
import { archetypes, getArchetype, getCard } from '../../data/deck'
import type { Card } from '../../data/types'
import { t } from '../../i18n/de'
import { displayTitle, fullLabel } from '../../lib/cardInfo'
import { asset } from '../../lib/assets'
import { CASE_REFS } from '../../workshop/deckRefs'

const p = t.room.participant

/** A flippable card with the "Text anzeigen" toggle; preloads the other side. */
export function RoomCard({ card }: { card: Card }) {
  const [flippedId, setFlippedId] = useState<string | null>(null)
  const flipped = flippedId === card.id
  const toggle = () => setFlippedId(flipped ? null : card.id)
  const [text, setText] = useState(false)
  const id = useId()
  useEffect(() => {
    const img = new Image()
    img.src = asset(card.images.back.full)
  }, [card])
  return (
    <div className="room-card">
      {text ? (
        <div className="room-card__text" id={id}>
          <h3>{fullLabel(card)}</h3>
          <CardText card={card} level={4} />
        </div>
      ) : (
        <FlipCard card={card} flipped={flipped} onFlip={toggle} />
      )}
      <div className="room-card__tools">
        {!text && (
          <button type="button" className="btn btn--small btn--ghost" onClick={toggle}>
            {p.flip}
          </button>
        )}
        <button
          type="button"
          className="btn btn--small btn--ghost"
          aria-expanded={text}
          aria-controls={text ? id : undefined}
          onClick={() => setText((v) => !v)}
        >
          {text ? p.showImage : p.showText}
        </button>
      </div>
    </div>
  )
}

/** Modal sheet for one card (dialog element: Esc closes, focus is trapped by the browser). */
export function CardSheet({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const card = cardId ? getCard(cardId) : undefined
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (card && !d.open) d.showModal?.()
    if (!card && d.open) d.close()
  }, [card])
  return (
    <dialog ref={ref} className="card-sheet" onClose={onClose} aria-label={card ? fullLabel(card) : undefined}>
      {card && (
        <>
          <RoomCard card={card} />
          <button type="button" className="btn btn--primary card-sheet__close" onClick={onClose}>
            {p.closeCard}
          </button>
        </>
      )}
    </dialog>
  )
}

export interface CaseGridProps {
  /** Voting: tap toggles a dot. Otherwise tap opens the card. */
  voting?: { mine: Set<string>; onToggle: (cardId: string) => void; full: boolean }
  /** Dots per case after reveal. */
  counts?: Map<string, number>
  onOpen: (cardId: string) => void
  /** Only these archetypes (default: all). */
  only?: string[]
}

/** The 28 case cards, grouped by archetype. */
export function CaseGrid({ voting, counts, onOpen, only }: CaseGridProps) {
  const list = only ? archetypes.filter((a) => only.includes(a.id)) : archetypes
  return (
    <div className="case-grid">
      {list.map((a) => (
        <section key={a.id} className="case-grid__group" style={{ ['--arch' as string]: a.colour }}>
          <h3 className="case-grid__title">
            <span className="case-grid__swatch" aria-hidden="true" />
            {t.room.archetype(a.number)} · {a.title}
          </h3>
          <ul>
            {CASE_REFS.filter((c) => c.archetypeId === a.id).map((ref) => {
              const card = getCard(ref.id)!
              const on = voting?.mine.has(ref.id) ?? false
              const n = counts?.get(ref.id)
              return (
                <li key={ref.id} className={`case-tile${on ? ' is-on' : ''}`}>
                  {voting ? (
                    <button
                      type="button"
                      className="case-tile__main"
                      aria-pressed={on}
                      aria-label={on ? p.dotOn(displayTitle(card)) : p.dotOff(displayTitle(card))}
                      disabled={!on && voting.full}
                      onClick={() => voting.onToggle(ref.id)}
                    >
                      <CardImage card={card} decorative />
                      <span className="case-tile__dot" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="case-tile__main"
                      onClick={() => onOpen(ref.id)}
                      aria-label={fullLabel(card)}
                    >
                      <CardImage card={card} decorative />
                    </button>
                  )}
                  <span className="case-tile__label">{displayTitle(card)}</span>
                  {voting && (
                    <button type="button" className="case-tile__view" onClick={() => onOpen(ref.id)}>
                      {p.viewCard}
                    </button>
                  )}
                  {n !== undefined && <span className="case-tile__count">{t.room.results.dots(n)}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The seven archetype fronts in a row (projector overview). */
export function ArchetypeStrip({ ids, highlight }: { ids?: readonly string[]; highlight?: readonly string[] }) {
  const list = ids ? ids.map((id) => getArchetype(id)!).filter(Boolean) : archetypes
  return (
    <ul className="arch-strip">
      {list.map((a) => {
        const card = getCard(`${a.id}-archetype`)
        return (
          <li key={a.id} className={highlight?.includes(a.id) ? 'is-highlight' : undefined}>
            {card && <CardImage card={card} sizes="(min-width: 1200px) 14vw, 30vw" />}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Group reading order: Überblickskarte → Eigenschaften-Karte (technology + organisation)
 * → the four Use-Case-Karten, one card per screen.
 */
export function ReadingSequence({ archetypeId }: { archetypeId: string }) {
  const own = [
    `${archetypeId}-archetype`,
    `${archetypeId}-technology`,
    `${archetypeId}-organisation`,
    ...[1, 2, 3, 4].map((n) => `${archetypeId}-case-${n}`),
  ]
  const cards = own.map((id) => getCard(id)).filter((c): c is Card => !!c)
  const [i, setI] = useState(0)
  const card = cards[Math.min(i, cards.length - 1)]
  const section = i === 0 ? p.overview : i <= 2 ? p.properties : p.useCases
  return (
    <div className="reading">
      <p className="reading__section">
        <strong>{section}</strong> · {p.readingStep(i + 1, cards.length)}
      </p>
      <ol className="reading__dots" aria-hidden="true">
        {cards.map((c, k) => (
          <li key={c.id} className={k === i ? 'is-current' : k < i ? 'is-done' : undefined} />
        ))}
      </ol>
      {card && <RoomCard card={card} />}
      <div className="action-bar">
        <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
          {p.prev}
        </button>
        <button type="button" className="btn btn--primary" disabled={i >= cards.length - 1} onClick={() => setI(i + 1)}>
          {p.next}
        </button>
      </div>
    </div>
  )
}
