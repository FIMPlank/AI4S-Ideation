import type { PlayMode } from '../data/types'

/**
 * The play modes, named and ordered as on the printed guide cards (the cards are
 * the most up-to-date source; the Leitfaden text was adjusted to match them).
 */
export interface ModeConfig {
  /** Stable route id, e.g. #/modus/inspiration-1 (from phase 2 on). */
  id: 'inspiration-1' | 'inspiration-2' | 'strategie'
  /** Name as printed on the guide card, used throughout the site. */
  name: string
  /** `mode` of the matching printed guide card in cards.json. */
  cardMode: PlayMode
  /** true once the guided flow exists (phase 2). */
  available: boolean
}

export const MODES: readonly ModeConfig[] = [
  { id: 'inspiration-1', name: 'Inspirations-Modus 1', cardMode: 'inspiration-1', available: false },
  { id: 'inspiration-2', name: 'Inspirations-Modus 2', cardMode: 'inspiration-2', available: false },
  { id: 'strategie', name: 'Strategie-Modus', cardMode: 'strategy', available: false },
]

export const modeForCard = (cardMode: PlayMode): ModeConfig => MODES.find((m) => m.cardMode === cardMode)!

/** Position of a printed guide card in the card order. */
export const modeOrder = (cardMode: PlayMode): number => MODES.findIndex((m) => m.cardMode === cardMode)
