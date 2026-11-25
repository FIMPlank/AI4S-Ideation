import type { Card } from '../data/types'
import { displayTitle, fullLabel, typeLabel } from '../lib/cardInfo'
import { href } from '../lib/router'
import { CardImage } from './CardImage'

/** Grid of card thumbnails linking into the viewer with the given list context. */
export function CardGrid({ cards, listParams }: { cards: Card[]; listParams: Record<string, string | undefined> }) {
  return (
    <ul className="card-grid">
      {cards.map((c, i) => {
        const type = typeLabel(c)
        const named = c.type === 'case' || c.type === 'guide'
        return (
          <li key={c.id}>
            <a className="card-grid__link" href={href(`/karte/${c.id}`, listParams)}>
              <CardImage card={c} decorative eager={i < 4} />
              <span className="card-grid__caption">
                <span className="card-grid__type">{type}</span>
                {named ? (
                  <>
                    <span className="card-grid__title">{displayTitle(c)}</span>
                  </>
                ) : (
                  // the image is decorative, so screen readers get the rest of the label here
                  <span className="visually-hidden">{fullLabel(c).slice(type.length)}</span>
                )}
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
