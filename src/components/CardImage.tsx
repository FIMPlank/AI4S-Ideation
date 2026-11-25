import type { Card } from '../data/types'
import { t } from '../i18n/de'
import { asset } from '../lib/assets'
import { fullLabel } from '../lib/cardInfo'

const SIZES = { full: [893, 1259], thumb: [298, 420] } as const

interface Props {
  card: Card
  side?: 'front' | 'back'
  /** thumb in grids and stacks, full only in the viewer. */
  size?: 'thumb' | 'full'
  /** Decorative images get empty alt text (the surrounding link/button names the card). */
  decorative?: boolean
  eager?: boolean
  /** Hint the browser that this is the page's main image (LCP). */
  priority?: boolean
  className?: string
  /** With sizes, the browser picks thumb or full from a srcset (for images shown larger than a thumb). */
  sizes?: string
}

export function CardImage({
  card,
  side = 'front',
  size = 'thumb',
  decorative,
  eager,
  priority,
  className,
  sizes,
}: Props) {
  const [w, h] = SIZES[size]
  const label = fullLabel(card)
  const alt = decorative ? '' : side === 'front' ? t.card.imageFront(label) : t.card.imageBack(label)
  return (
    <img
      className={`card-img${className ? ` ${className}` : ''}`}
      src={asset(card.images[side][size])}
      srcSet={
        sizes
          ? `${asset(card.images[side].thumb)} ${SIZES.thumb[0]}w, ${asset(card.images[side].full)} ${SIZES.full[0]}w`
          : undefined
      }
      sizes={sizes}
      alt={alt}
      width={w}
      height={h}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
    />
  )
}
