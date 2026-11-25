import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { CardText } from '../components/CardText'
import { FlipCard } from '../components/FlipCard'
import { SdgList } from '../components/SdgChip'
import { ShareButton } from '../components/ShareButton'
import { colourOf, getArchetype, getCard } from '../data/deck'
import { cardSdgs } from '../data/query'
import type { Card } from '../data/types'
import { t } from '../i18n/de'
import { asset } from '../lib/assets'
import { displayTitle, fullLabel, shortTitle, typeLabel } from '../lib/cardInfo'
import { resolveList } from '../lib/cardList'
import { absoluteUrl, href, navigate } from '../lib/router'
import { NotFound } from './NotFound'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

/** Warm the cache for neighbouring cards so prev/next feels instant. */
function preload(cards: (Card | undefined)[]) {
  for (const c of cards) {
    if (!c) continue
    const img = new Image()
    img.src = asset(c.images.front.full)
  }
}

export function CardViewer({ id, params }: { id: string; params: URLSearchParams }) {
  const card = getCard(id)
  // flip state belongs to one card: paging to another card shows its front again
  const [flippedId, setFlippedId] = useState<string | null>(null)
  const flipped = flippedId === id
  const setFlipped = (f: (was: boolean) => boolean) => setFlippedId(f(flipped) ? id : null)
  const [showText, setShowText] = useState(false)
  const textId = useId()
  const touch = useRef<{ x: number; y: number } | null>(null)
  const v = t.viewer

  const list = card ? resolveList(params, card) : undefined
  const pos = list && card ? list.cards.findIndex((c) => c.id === card.id) : -1
  const prev = list && pos > 0 ? list.cards[pos - 1] : undefined
  const next = list && pos >= 0 && pos < list.cards.length - 1 ? list.cards[pos + 1] : undefined
  const linkTo = (c: Card) => href(`/karte/${c.id}`, list?.params)

  useEffect(() => preload([prev, next]), [prev, next])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return
      if (e.key === 'ArrowLeft' && prev) navigate(linkTo(prev), { replace: true })
      else if (e.key === 'ArrowRight' && next) navigate(linkTo(next), { replace: true })
      else if (e.key === ' ' || e.key === 'Enter') {
        // the card button handles its own Space/Enter; elsewhere only when nothing interactive has focus
        const el = e.target as HTMLElement
        if (el === document.body || el.id === 'main' || el.tagName === 'H1') {
          e.preventDefault()
          setFlipped((f) => !f)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!card || !list) return <NotFound />
  const archetype = getArchetype(card.archetypeId)

  return (
    <div className="viewer" style={{ '--deck': colourOf(card) } as CSSProperties}>
      <div className="container viewer__layout">
        <div className="viewer__head">
          <p className="viewer__crumbs">
            <a href={list.backHref}>
              ← <span className="visually-hidden">{v.crumbs}: </span>
              {list.label}
            </a>
          </p>
          <h1 className="viewer__title">
            <span className="viewer__type">
              {typeLabel(card)}
              {archetype && ` · ${t.deck.archetype(archetype.number)}`}
            </span>
            {displayTitle(card)}
          </h1>
          {archetype && card.type !== 'archetype' && (
            <p className="viewer__arche">
              <a href={`#/archetyp/${archetype.id}`}>{archetype.title}</a>
            </p>
          )}
        </div>

        <div
          className="viewer__stage"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const start = touch.current
            touch.current = null
            if (!start) return
            const dx = e.changedTouches[0].clientX - start.x
            const dy = e.changedTouches[0].clientY - start.y
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
            const target = dx < 0 ? next : prev
            if (target) navigate(linkTo(target), { replace: true })
          }}
        >
          <FlipCard card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <p className="viewer__hint">{v.hint}</p>
        </div>

        <div className="viewer__side">
          <nav className="viewer__pager" aria-label={v.pager}>
            {prev ? (
              <a className="btn btn--small" href={linkTo(prev)} rel="prev">
                ← <span className="visually-hidden">{v.prev} </span>
                <span className="viewer__pager-label">{shortTitle(prev)}</span>
              </a>
            ) : (
              <span />
            )}
            <span className="viewer__pos">
              <span aria-hidden="true">
                {pos + 1} / {list.cards.length}
              </span>
              <span className="visually-hidden">{v.position(pos + 1, list.cards.length)}</span>
            </span>
            {next ? (
              <a className="btn btn--small" href={linkTo(next)} rel="next">
                <span className="visually-hidden">{v.next} </span>
                <span className="viewer__pager-label">{shortTitle(next)}</span> →
              </a>
            ) : (
              <span />
            )}
          </nav>

          <div className="viewer__actions">
            <button
              type="button"
              className="btn"
              aria-expanded={showText}
              aria-controls={textId}
              onClick={() => setShowText((s) => !s)}
            >
              {showText ? v.hideText : v.showText}
            </button>
            <ShareButton title={fullLabel(card)} url={absoluteUrl(href(`/karte/${card.id}`))} />
          </div>

          <section id={textId} className="viewer__text" hidden={!showText} aria-label={v.textTitle}>
            <CardText card={card} level={2} />
          </section>

          <SdgList ids={cardSdgs(archetype)} label={v.sdgs} />
        </div>
      </div>
    </div>
  )
}
