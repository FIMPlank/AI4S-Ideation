import type { CSSProperties } from 'react'

/** Colour tokens a tile can use (see src/styles/tokens.css). */
export type TileColour = 'navy' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7'

/**
 * The brochure's shape vocabulary: a coloured tile with one inner shape.
 * - quarter-*: quarter circle filling the tile, round corner at tl/tr/br/bl
 * - leaf / leaf-alt: two opposite round corners (tr+bl / tl+br)
 * - dome: half circle on the bottom half; arch: full-height dome
 * - bowl: bottom corners round
 * - circle: inset circle; disc: circle filling the tile
 */
export type TileShape =
  | 'quarter-tl'
  | 'quarter-tr'
  | 'quarter-br'
  | 'quarter-bl'
  | 'leaf'
  | 'leaf-alt'
  | 'dome'
  | 'arch'
  | 'bowl'
  | 'circle'
  | 'disc'
  | 'none'

export interface TileProps {
  bg: TileColour
  fg?: TileColour
  shape: TileShape
  className?: string
  style?: CSSProperties
}

const colour = (c: TileColour) => `var(--${c})`

/** Decorative only: always aria-hidden. */
export function Tile({ bg, fg, shape, className, style }: TileProps) {
  return (
    <span
      className={`tile${className ? ` ${className}` : ''}`}
      style={{ background: colour(bg), ...style }}
      aria-hidden="true"
    >
      {shape !== 'none' && fg && (
        <span className={`tile__shape tile__shape--${shape}`} style={{ background: colour(fg) }} />
      )}
    </span>
  )
}
