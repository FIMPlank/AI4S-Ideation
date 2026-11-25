import { Tile } from '../Tile'
import { LOGO_TILES } from './tiles'

/** 2×2 tile mosaic (placeholder mark until the FFTT logo arrives). */
export function LogoMark({ className = 'logo-mark' }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {LOGO_TILES.map((tile, i) => (
        <Tile key={i} {...tile} />
      ))}
    </span>
  )
}
