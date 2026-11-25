import type { Card } from '../data/types'
import { t } from '../i18n/de'
import { fullLabel } from '../lib/cardInfo'
import { CardImage } from './CardImage'

/**
 * Large two-sided card. The whole card is one toggle button (click, tap, Space, Enter).
 * Both sides load eagerly, so the back is ready when the user flips.
 * With prefers-reduced-motion the CSS turns the 3D flip into a crossfade.
 */
export function FlipCard({ card, flipped, onFlip }: { card: Card; flipped: boolean; onFlip: () => void }) {
  return (
    <button
      type="button"
      className={`flip-card${flipped ? ' is-flipped' : ''}`}
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={t.viewer.flipLabel(fullLabel(card), flipped)}
    >
      <span className="flip-card__inner">
        <span className="flip-card__side flip-card__side--front">
          <CardImage card={card} side="front" size="full" decorative eager priority />
        </span>
        <span className="flip-card__side flip-card__side--back">
          <CardImage card={card} side="back" size="full" decorative eager />
        </span>
      </span>
    </button>
  )
}
