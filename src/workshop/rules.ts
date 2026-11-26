/**
 * Who may do what. Mirrors the RLS policies and RPC checks in supabase/migrations,
 * so the in-memory store behaves like the real backend.
 */
import { HIDDEN_INPUT } from './flows'
import { LIMITS } from './limits'
import { dotsUsed } from './tally'
import type { Idea, Me, Room, RoomSnapshot } from './types'

export type DenyReason =
  | 'not-member'
  | 'not-facilitator'
  | 'closed'
  | 'wrong-step'
  | 'not-your-group'
  | 'no-dots-left'
  | 'not-case'
  | 'too-long'
  | 'too-many-ideas'
  | 'room-full'
  | 'stale-step'
  | 'invalid'
  | 'sign-in-disabled'
  | 'taken'
  | 'not-found'

export class WorkshopError extends Error {
  readonly reason: DenyReason
  constructor(reason: DenyReason, message?: string) {
    super(message ?? reason)
    this.reason = reason
    this.name = 'WorkshopError'
  }
}

export const isFacilitator = (me: Me) => me.role === 'facilitator'
export const isMember = (me: Me) => me.memberId !== null
export const isOpen = (room: Room) => room.status !== 'closed'

export const votesVisible = (room: Room) => room.revealed.includes(HIDDEN_INPUT.votes)
export const ratingsVisible = (room: Room) => room.revealed.includes(HIDDEN_INPUT.ratings)

/** What `me` may read: everything of the room, but others' votes/ratings only after reveal. */
export function visibleTo(full: RoomSnapshot, me: Me): RoomSnapshot {
  const { room } = full
  return {
    ...full,
    votes: votesVisible(room) ? full.votes : full.votes.filter((v) => v.userId === me.userId),
    ratings: ratingsVisible(room) ? full.ratings : full.ratings.filter((r) => r.userId === me.userId),
  }
}

export function assertMember(me: Me): void {
  if (!isMember(me)) throw new WorkshopError('not-member')
}

export function assertWritable(room: Room, me: Me): void {
  assertMember(me)
  if (!isOpen(room)) throw new WorkshopError('closed')
}

export function assertFacilitator(room: Room, me: Me): void {
  assertWritable(room, me)
  if (!isFacilitator(me)) throw new WorkshopError('not-facilitator')
}

/** Group members and facilitators edit a group's ideas. */
export const canEditGroup = (me: Me, groupNo: number) =>
  isFacilitator(me) || (me.groupNo !== null && me.groupNo === groupNo)

export const canEditIdea = (me: Me, idea: Pick<Idea, 'groupNo'>) => canEditGroup(me, idea.groupNo)

/** A group member or the facilitator may tap "Ziehen". */
export const canDraw = (me: Me, groupNo: number) => canEditGroup(me, groupNo)

/** Checks a vote toggle; returns 'add' or 'remove'. */
export function checkVote(snap: RoomSnapshot, me: Me, isCase: boolean, has: boolean): 'add' | 'remove' {
  assertWritable(snap.room, me)
  if (snap.room.stepKey !== HIDDEN_INPUT.votes) throw new WorkshopError('wrong-step')
  if (has) return 'remove'
  if (!isCase) throw new WorkshopError('not-case')
  if (dotsUsed(snap.votes, me.userId) >= snap.room.settings.dotsPerPerson) throw new WorkshopError('no-dots-left')
  return 'add'
}

export function checkRating(snap: RoomSnapshot, me: Me, score: number | null): void {
  assertWritable(snap.room, me)
  if (snap.room.stepKey !== HIDDEN_INPUT.ratings) throw new WorkshopError('wrong-step')
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 5)) throw new WorkshopError('invalid')
}

export function checkLength(value: string, max: number): string {
  const v = value.trim()
  if (v.length > max) throw new WorkshopError('too-long')
  return v
}

export const checkDisplayName = (name: string): string => {
  const v = checkLength(name.replace(/\s+/g, ' '), LIMITS.displayName)
  if (!v) throw new WorkshopError('invalid')
  return v
}
