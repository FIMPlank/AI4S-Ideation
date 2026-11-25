import type { TileProps } from '../Tile'

type T = Omit<TileProps, 'className' | 'style'>

/** Tile compositions from design/landing (brochure cover vocabulary). */
export const LOGO_TILES: T[] = [
  { bg: 'navy', fg: 'a6', shape: 'quarter-tl' },
  { bg: 'a7', fg: 'a5', shape: 'leaf' },
  { bg: 'a4', fg: 'a2', shape: 'quarter-tr' },
  { bg: 'a1', shape: 'none' },
]

export const HERO_TILES: T[] = [
  { bg: 'navy', fg: 'a6', shape: 'quarter-tl' },
  { bg: 'a7', fg: 'a6', shape: 'leaf' },
  { bg: 'a5', fg: 'a2', shape: 'circle' },
  { bg: 'a4', fg: 'a5', shape: 'leaf-alt' },
  { bg: 'a1', fg: 'a7', shape: 'dome' },
  { bg: 'navy', fg: 'a5', shape: 'dome' },
  { bg: 'a7', fg: 'a2', shape: 'quarter-tr' },
  { bg: 'a1', fg: 'a4', shape: 'bowl' },
  { bg: 'a6', fg: 'navy', shape: 'quarter-bl' },
]

/** One icon per play mode, in mode order. */
export const MODE_TILES: T[] = [
  { bg: 'a7', fg: 'navy', shape: 'quarter-tl' },
  { bg: 'a5', fg: 'a2', shape: 'leaf' },
  { bg: 'a4', fg: 'a6', shape: 'arch' },
]

/** One icon per Kernvorteil, in brochure order. */
export const BENEFIT_TILES: T[] = [
  { bg: 'navy', fg: 'a7', shape: 'quarter-tl' },
  { bg: 'a2', fg: 'a5', shape: 'leaf' },
  { bg: 'a1', fg: 'a6', shape: 'arch' },
  { bg: 'a4', fg: 'a5', shape: 'disc' },
]

export const FOOTER_TILES: T[] = [
  { bg: 'a1', fg: 'a2', shape: 'arch' },
  { bg: 'a3', fg: 'a7', shape: 'leaf' },
  { bg: 'a5', fg: 'a4', shape: 'quarter-tl' },
  { bg: 'a2', fg: 'a5', shape: 'bowl' },
  { bg: 'a6', fg: 'navy', shape: 'quarter-tr' },
  { bg: 'a7', fg: 'a1', shape: 'leaf-alt' },
  { bg: 'a4', fg: 'a6', shape: 'arch' },
]
