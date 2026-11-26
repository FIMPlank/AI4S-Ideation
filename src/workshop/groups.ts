import type { Member } from './types'

export type GroupAssignment = Record<string, number | null>

/** Group sizes 1..groupCount (index 0 = group 1), participants only. */
export function groupSizes(members: Pick<Member, 'role' | 'groupNo'>[], groupCount: number): number[] {
  const sizes = Array.from({ length: groupCount }, () => 0)
  for (const m of members) if (m.role === 'participant' && m.groupNo && m.groupNo <= groupCount) sizes[m.groupNo - 1]++
  return sizes
}

/**
 * Keeps existing valid assignments and puts everyone else into the smallest group
 * (ties: lowest number), in join order. Facilitators are never in a group.
 */
export function balanceGroups(
  members: Pick<Member, 'id' | 'role' | 'groupNo' | 'joinedAt'>[],
  groupCount: number,
): GroupAssignment {
  const out: GroupAssignment = {}
  const sizes = Array.from({ length: groupCount }, () => 0)
  const ordered = [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
  const pending: string[] = []
  for (const m of ordered) {
    if (m.role !== 'participant') {
      out[m.id] = null
    } else if (m.groupNo && m.groupNo >= 1 && m.groupNo <= groupCount) {
      out[m.id] = m.groupNo
      sizes[m.groupNo - 1]++
    } else {
      pending.push(m.id)
    }
  }
  for (const id of pending) {
    const g = smallest(sizes)
    out[id] = g + 1
    sizes[g]++
  }
  return out
}

/** Fresh random groups of near-equal size. */
export function shuffleGroups(
  members: Pick<Member, 'id' | 'role'>[],
  groupCount: number,
  random: () => number = Math.random,
): GroupAssignment {
  const out: GroupAssignment = {}
  const ids = members.filter((m) => m.role === 'participant').map((m) => m.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  ids.forEach((id, i) => (out[id] = (i % groupCount) + 1))
  for (const m of members) if (m.role !== 'participant') out[m.id] = null
  return out
}

/** The group a newcomer joins: the smallest one. */
export const groupForNewcomer = (members: Pick<Member, 'role' | 'groupNo'>[], groupCount: number): number =>
  smallest(groupSizes(members, groupCount)) + 1

function smallest(sizes: number[]): number {
  let best = 0
  for (let i = 1; i < sizes.length; i++) if (sizes[i] < sizes[best]) best = i
  return best
}

/**
 * Groups for participants who have none yet, each into the currently
 * smallest group. Returns only the changed members (empty when nothing to do).
 */
export function assignUngrouped(
  members: Pick<Member, 'id' | 'role' | 'groupNo'>[],
  groupCount: number,
): Record<string, number> {
  const work = members.map((m) => ({ ...m }))
  const out: Record<string, number> = {}
  for (const m of work) {
    if (m.role !== 'participant' || m.groupNo !== null) continue
    m.groupNo = groupForNewcomer(work, groupCount)
    out[m.id] = m.groupNo
  }
  return out
}
