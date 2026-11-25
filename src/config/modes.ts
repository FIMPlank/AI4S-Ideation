import type { PlayMode } from '../data/types'

/**
 * The play modes, named and ordered as in the brochure (Leitfaden).
 * The printed guide cards use older names: brochure "Inspirations-Modus" is the
 * card "Inspirations-Modus 2", brochure "Ideation-Modus" is the card
 * "Inspirations-Modus 1". The website uses the brochure names everywhere and shows
 * the printed name as a hint, so people with the physical deck find their card.
 */
export interface ModeConfig {
  /** Stable route id, e.g. #/modus/ideation (from phase 2 on). */
  id: 'inspiration' | 'ideation' | 'strategie'
  /** Brochure name, used throughout the site. */
  name: string
  /** `mode` of the matching printed guide card in cards.json. */
  cardMode: PlayMode
  /** Name printed on that card. */
  printedName: string
  /** true once the guided flow exists (phase 2). */
  available: boolean
}

export const MODES: readonly ModeConfig[] = [
  {
    id: 'inspiration',
    name: 'Inspirations-Modus',
    cardMode: 'inspiration-2',
    printedName: 'Inspirations-Modus 2',
    available: false,
  },
  {
    id: 'ideation',
    name: 'Ideation-Modus',
    cardMode: 'inspiration-1',
    printedName: 'Inspirations-Modus 1',
    available: false,
  },
  { id: 'strategie', name: 'Strategie-Modus', cardMode: 'strategy', printedName: 'Strategie-Modus', available: false },
]

/** Route ids used by the printed cards' numbering; redirect these once mode routes exist. */
export const LEGACY_MODE_IDS: Record<string, ModeConfig['id']> = {
  'inspiration-1': 'ideation',
  'inspiration-2': 'inspiration',
  strategy: 'strategie',
}

export const modeForCard = (cardMode: PlayMode): ModeConfig => MODES.find((m) => m.cardMode === cardMode)!

/** Position of a printed guide card in the brochure order. */
export const modeOrder = (cardMode: PlayMode): number => MODES.findIndex((m) => m.cardMode === cardMode)
