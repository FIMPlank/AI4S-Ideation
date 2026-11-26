/**
 * Steps of each mode, taken from the printed guide cards (src/data/cards.json,
 * type "guide"). Labels live in src/i18n/de.ts under room.steps[key].
 */
import type { ModeId, RoomSettings, StepKey } from './types'

/**
 * - karte: a step printed on the guide card (guideSteps = its 0-based step numbers)
 * - leitfaden: an addition from the Leitfaden, optional, can be switched off
 * - web: needed only online (e.g. revealing hidden votes)
 */
export type StepSource = 'karte' | 'leitfaden' | 'web'

/** What the step is about, so screens and rules can switch on it. */
export type StepKind =
  'read' | 'vote' | 'reveal' | 'discuss' | 'groups' | 'draw' | 'timer' | 'ideas' | 'pitch' | 'select' | 'rate' | 'plan'

export interface StepDef {
  key: StepKey
  mode: ModeId
  kind: StepKind
  source: StepSource
  /** Guide card steps this covers (0-based). Empty for non-card steps. */
  guideSteps: number[]
  /** Set for optional steps: the setting that switches it on. */
  optional?: 'klaerung' | 'pitch'
}

export const FLOWS: Record<ModeId, readonly StepDef[]> = {
  'inspiration-2': [
    { key: 'i2.lesen', mode: 'inspiration-2', kind: 'read', source: 'karte', guideSteps: [0, 1] },
    { key: 'i2.markieren', mode: 'inspiration-2', kind: 'vote', source: 'karte', guideSteps: [2] },
    { key: 'i2.aufloesen', mode: 'inspiration-2', kind: 'reveal', source: 'web', guideSteps: [] },
    { key: 'i2.diskutieren', mode: 'inspiration-2', kind: 'discuss', source: 'karte', guideSteps: [3] },
  ],
  'inspiration-1': [
    { key: 'i1.gruppen', mode: 'inspiration-1', kind: 'groups', source: 'karte', guideSteps: [0] },
    { key: 'i1.ziehen', mode: 'inspiration-1', kind: 'draw', source: 'karte', guideSteps: [1] },
    { key: 'i1.lesen', mode: 'inspiration-1', kind: 'read', source: 'karte', guideSteps: [2] },
    {
      key: 'i1.klaerung',
      mode: 'inspiration-1',
      kind: 'timer',
      source: 'leitfaden',
      guideSteps: [],
      optional: 'klaerung',
    },
    { key: 'i1.entwickeln', mode: 'inspiration-1', kind: 'ideas', source: 'karte', guideSteps: [3] },
    { key: 'i1.pitch', mode: 'inspiration-1', kind: 'pitch', source: 'leitfaden', guideSteps: [], optional: 'pitch' },
  ],
  strategie: [
    { key: 'st.auswaehlen', mode: 'strategie', kind: 'select', source: 'karte', guideSteps: [0] },
    { key: 'st.diskutieren', mode: 'strategie', kind: 'discuss', source: 'karte', guideSteps: [1] },
    { key: 'st.bewerten', mode: 'strategie', kind: 'rate', source: 'karte', guideSteps: [2] },
    // the guide card's result line: "Priorisierte KI-Use-Cases & erste Umsetzungsschritte"
    { key: 'st.umsetzung', mode: 'strategie', kind: 'plan', source: 'karte', guideSteps: [] },
  ],
}

const ALL = Object.values(FLOWS).flat()
const BY_KEY = new Map(ALL.map((s) => [s.key, s]))

export const stepDef = (key: StepKey): StepDef | undefined => BY_KEY.get(key)

export const isStepEnabled = (def: StepDef, settings: RoomSettings): boolean =>
  !def.optional || settings[def.optional].enabled

/** Steps with hidden input and where it is revealed. */
export const HIDDEN_INPUT = {
  votes: 'i2.markieren',
  ratings: 'st.bewerten',
} as const satisfies Record<string, StepKey>

/** The discussion questions of a step (keys into i18n), from the guide cards. */
export const DISCUSSION_TOPICS: Partial<Record<StepKey, readonly string[]>> = {
  'i2.diskutieren': ['relevant', 'uebertragbar'],
  'st.diskutieren': ['technik', 'organisation', 'umsetzung'],
}
