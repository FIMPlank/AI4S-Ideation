/** Maps database rows (snake_case, ISO timestamps) to the domain types. */
import { normalizeSettings } from '../../workshop/settings'
import type {
  GroupDraw,
  Idea,
  ImplStep,
  Member,
  Note,
  Rating,
  Room,
  RoomSnapshot,
  Selection,
  Vote,
} from '../../workshop'

type Row = Record<string, unknown>
const ms = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) : typeof v === 'number' ? v : 0)
const msOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : ms(v))
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

export const toRoom = (r: Row): Room => ({
  id: str(r.id),
  code: str(r.code),
  title: str(r.title),
  program: r.program as Room['program'],
  settings: normalizeSettings(r.settings as Room['settings']),
  status: r.status as Room['status'],
  stepKey: r.step_key as Room['stepKey'],
  stepStartedAt: ms(r.step_started_at),
  timer: { durationMs: num(r.timer_duration_ms), endsAt: msOrNull(r.timer_ends_at), pausedMs: num(r.timer_paused_ms) },
  revealed: (r.revealed as Room['revealed']) ?? [],
  pitchGroup: num(r.pitch_group),
  createdAt: ms(r.created_at),
  expiresAt: ms(r.expires_at),
  researchMode: r.research_mode === true,
})

export const toMember = (r: Row): Member => ({
  id: str(r.id),
  userId: str(r.user_id),
  role: r.role as Member['role'],
  displayName: str(r.display_name),
  groupNo: num(r.group_no),
  joinedAt: ms(r.joined_at),
  lastSeenAt: ms(r.last_seen_at),
  researchConsent: r.research_consent === true,
})

export const toDraw = (r: Row): GroupDraw => ({
  id: str(r.id),
  groupNo: num(r.group_no) ?? 0,
  archetypeId: str(r.archetype_id),
  method: r.method as GroupDraw['method'],
  drawnBy: str(r.drawn_by),
  drawnAt: ms(r.drawn_at),
})

export const toIdea = (r: Row): Idea => ({
  id: str(r.id),
  groupNo: num(r.group_no) ?? 0,
  title: str(r.title),
  description: str(r.description),
  inspiredBy: (r.inspired_by as string | null) ?? null,
  target: str(r.target),
  createdBy: str(r.created_by),
  updatedAt: ms(r.updated_at),
})

export const toVote = (r: Row): Vote => ({ id: str(r.id), userId: str(r.user_id), cardId: str(r.card_id) })

export const toRating = (r: Row): Rating => ({
  id: str(r.id),
  userId: str(r.user_id),
  selectionId: str(r.selection_id),
  criterion: r.criterion as Rating['criterion'],
  score: num(r.score) ?? 0,
})

export const toNote = (r: Row): Note => ({
  id: str(r.id),
  stepKey: r.step_key as Note['stepKey'],
  topic: str(r.topic),
  selectionId: (r.selection_id as string | null) ?? null,
  body: str(r.body),
  authorId: str(r.author_id),
  byFacilitator: r.by_facilitator === true,
  createdAt: ms(r.created_at),
})

export const toSelection = (r: Row): Selection => ({
  id: str(r.id),
  kind: r.kind as Selection['kind'],
  refType: r.ref_type as Selection['refType'],
  refId: str(r.ref_id),
  position: num(r.position) ?? 0,
})

export const toImplStep = (r: Row): ImplStep => ({
  id: str(r.id),
  selectionId: str(r.selection_id),
  what: str(r.what),
  who: str(r.who),
  due: (r.due as string | null) ?? null,
  position: num(r.position) ?? 0,
  createdBy: str(r.created_by),
})

const list = <T>(v: unknown, f: (r: Row) => T): T[] => (Array.isArray(v) ? v.map((x) => f(x as Row)) : [])

/** room_snapshot() → RoomSnapshot (null when the caller can't see the room). */
export function toSnapshot(j: Row): RoomSnapshot | null {
  if (!j || !j.room) return null
  return {
    room: toRoom(j.room as Row),
    members: list(j.members, toMember),
    draws: list(j.draws, toDraw),
    ideas: list(j.ideas, toIdea),
    votes: list(j.votes, toVote),
    ratings: list(j.ratings, toRating),
    notes: list(j.notes, toNote),
    selections: list(j.selections, toSelection),
    implSteps: list(j.implSteps, toImplStep),
  }
}

/** Table name → snapshot key + mapper, for Realtime events. */
export const TABLES = {
  room_members: { key: 'members', map: toMember },
  group_draws: { key: 'draws', map: toDraw },
  ideas: { key: 'ideas', map: toIdea },
  votes: { key: 'votes', map: toVote },
  ratings: { key: 'ratings', map: toRating },
  notes: { key: 'notes', map: toNote },
  selections: { key: 'selections', map: toSelection },
  impl_steps: { key: 'implSteps', map: toImplStep },
} as const

export type TableName = keyof typeof TABLES

const REASONS = [
  'not-member',
  'not-facilitator',
  'closed',
  'wrong-step',
  'not-your-group',
  'no-dots-left',
  'not-case',
  'too-long',
  'too-many-ideas',
  'room-full',
  'stale-step',
  'invalid',
  'taken',
  'not-found',
] as const

/** A PostgREST/Postgres error → a DenyReason (see public.deny() in the migration). */
export function toReason(err: { message?: string; code?: string } | null | undefined): (typeof REASONS)[number] {
  const m = err?.message ?? ''
  const known = REASONS.find((r) => m === r)
  if (known) return known
  if (m === 'rate-limited') return 'invalid'
  if (err?.code === '23505') return 'taken'
  if (err?.code === '23514') return 'invalid'
  if (err?.code === '42501' || /row-level security/.test(m)) return 'wrong-step'
  return 'invalid'
}
