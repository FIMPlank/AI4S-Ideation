import { useMemo } from 'react'
import { ARCHETYPE_IDS, CASE_REFS } from '../workshop/deckRefs'
import {
  prioritisedArchetypes,
  strategyCandidates,
  tallyVotes,
  voteProgress,
  ratingProgress,
  type RoomSnapshot,
} from '../workshop'

export const useTally = (snap: RoomSnapshot) =>
  useMemo(() => tallyVotes(snap.votes, CASE_REFS, ARCHETYPE_IDS), [snap.votes])

export const usePrioritised = (snap: RoomSnapshot) =>
  useMemo(() => prioritisedArchetypes(snap, CASE_REFS, ARCHETYPE_IDS), [snap])

export const useCandidates = (snap: RoomSnapshot) =>
  useMemo(() => strategyCandidates(snap, CASE_REFS, ARCHETYPE_IDS), [snap])

/** Progress from what this client can see (the facilitator sees all members, and the store adds hidden counts). */
export function progressOf(snap: RoomSnapshot, hidden?: { voted: number; rated: number; participants: number }) {
  if (hidden)
    return {
      votes: { done: hidden.voted, total: hidden.participants },
      ratings: { done: hidden.rated, total: hidden.participants },
    }
  return {
    votes: voteProgress(snap.members, snap.votes, snap.room.settings.dotsPerPerson),
    ratings: ratingProgress(snap.members, snap.ratings, snap.selections),
  }
}

export const groupsOf = (snap: RoomSnapshot) => Array.from({ length: snap.room.settings.groupCount }, (_, i) => i + 1)
