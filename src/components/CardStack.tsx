import type { CSSProperties } from 'react'
import type { Card } from '../data/types'
import { textOn } from '../lib/color'
import { CardImage } from './CardImage'

/** A fanned stack of a deck's first cards in its colour, as one link. */
export function CardStack(props: {
  cards: Card[]
  to: string
  colour: string
  kicker?: string
  title: string
  subtitle: string
  eager?: boolean
}) {
  const { cards, to, colour, kicker, title, subtitle, eager } = props
  const shown = cards.slice(0, 3).reverse()
  return (
    <a className="card-stack" href={to} style={{ '--deck': colour, '--deck-ink': textOn(colour) } as CSSProperties}>
      <span className="card-stack__fan" aria-hidden="true">
        {shown.map((c, i) => (
          <span key={c.id} className="card-stack__card" style={{ '--i': i - (shown.length - 1) / 2 } as CSSProperties}>
            <CardImage card={c} decorative eager={eager} />
          </span>
        ))}
      </span>
      <span className="card-stack__text">
        {kicker && <span className="card-stack__kicker">{kicker}</span>}
        <span className="card-stack__title">{title}</span>
        <span className="card-stack__sub">{subtitle}</span>
      </span>
    </a>
  )
}
