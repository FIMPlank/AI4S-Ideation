/**
 * Domain types of a workshop room. Backend-agnostic: the Supabase store maps its
 * rows onto these, the in-memory store uses them directly. Times are epoch ms.
 */
import type { ModeId } from '../config/modes'

export type { ModeId }

/** One mode, or the full workshop (Inspirations-Modus 2 → 1 → Strategie-Modus). */
export type ProgramId = ModeId | 'komplett'

export type StepKey =
  | 'lobby'
  | 'i2.lesen'
  | 'i2.markieren'
  | 'i2.aufloesen'
  | 'i2.diskutieren'
  | 'i1.gruppen'
  | 'i1.ziehen'
  | 'i1.lesen'
  | 'i1.klaerung'
  | 'i1.entwickeln'
  | 'i1.pitch'
  | 'st.auswaehlen'
  | 'st.diskutieren'
  | 'st.bewerten'
  | 'st.umsetzung'
  | 'ende'

export interface RoomSettings {
  /** 1–7: one archetype per group, never twice. */
  groupCount: number
  /** 2–5, default 3. */
  dotsPerPerson: number
  /** Timer presets in minutes, shown as quick buttons. */
  timerPresetsMin: number[]
  /** Optional step from the Leitfaden (Allgemeine Vorbereitung, step 2). */
  klaerung: { enabled: boolean; minutes: number }
  /** Optional step from the Leitfaden (not on the guide card). */
  pitch: { enabled: boolean; minutesPerGroup: number }
}

export type RoomStatus = 'lobby' | 'running' | 'closed'

/** Running: endsAt set. Paused: pausedMs = remaining. Idle: both null. */
export interface TimerState {
  durationMs: number | null
  endsAt: number | null
  pausedMs: number | null
}

export interface Room {
  id: string
  code: string
  title: string
  program: ProgramId
  settings: RoomSettings
  status: RoomStatus
  stepKey: StepKey
  stepStartedAt: number
  timer: TimerState
  /** Steps whose hidden input (votes, ratings) everyone may now see. */
  revealed: StepKey[]
  /** Group currently pitching (i1.pitch). */
  pitchGroup: number | null
  createdAt: number
  expiresAt: number
  researchMode: boolean
}

export type Role = 'facilitator' | 'participant'

export interface Member {
  id: string
  userId: string
  role: Role
  displayName: string
  groupNo: number | null
  joinedAt: number
  lastSeenAt: number
  researchConsent: boolean
}

export type DrawMethod = 'random' | 'manual' | 'priorisiert'

export interface GroupDraw {
  id: string
  groupNo: number
  archetypeId: string
  method: DrawMethod
  drawnBy: string
  drawnAt: number
}

export interface Idea {
  id: string
  groupNo: number
  title: string
  description: string
  /** Case card id ("inspiriert von"), optional. */
  inspiredBy: string | null
  /** Zielgruppe / Prozess. */
  target: string
  createdBy: string
  updatedAt: number
}

/** One dot on one case card. */
export interface Vote {
  id: string
  userId: string
  cardId: string
}

export const CRITERIA = ['nachhaltigkeit', 'umsetzbarkeit', 'geschaeftsnutzen'] as const
export type Criterion = (typeof CRITERIA)[number]

export interface Rating {
  id: string
  userId: string
  selectionId: string
  criterion: Criterion
  /** 1–5 */
  score: number
}

export interface Note {
  id: string
  stepKey: StepKey
  /** Question key, e.g. "relevant" or "technik". */
  topic: string
  selectionId: string | null
  body: string
  authorId: string
  byFacilitator: boolean
  createdAt: number
}

export type SelectionKind = 'relevant_archetype' | 'strategy_target'
export type RefType = 'archetype' | 'card' | 'idea'

export interface Selection {
  id: string
  kind: SelectionKind
  refType: RefType
  refId: string
  position: number
}

export interface ImplStep {
  id: string
  selectionId: string
  what: string
  who: string
  /** ISO date (YYYY-MM-DD) or null. */
  due: string | null
  position: number
  createdBy: string
}

/** Everything one member may see of a room. */
export interface RoomSnapshot {
  room: Room
  members: Member[]
  draws: GroupDraw[]
  ideas: Idea[]
  votes: Vote[]
  ratings: Rating[]
  notes: Note[]
  selections: Selection[]
  implSteps: ImplStep[]
}

/** The current browser's identity in a room. */
export interface Me {
  userId: string
  memberId: string | null
  role: Role | null
  groupNo: number | null
}
