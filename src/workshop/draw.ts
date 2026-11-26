import type { GroupDraw } from './types'

/** Archetypes not yet drawn by any group, in the given order. */
export const availableArchetypes = (all: readonly string[], draws: Pick<GroupDraw, 'archetypeId'>[]): string[] => {
  const taken = new Set(draws.map((d) => d.archetypeId))
  return all.filter((id) => !taken.has(id))
}

/** A random archetype that no group has yet; null when all are taken. */
export function drawArchetype(
  all: readonly string[],
  draws: Pick<GroupDraw, 'archetypeId'>[],
  random: () => number = Math.random,
): string | null {
  const free = availableArchetypes(all, draws)
  return free.length ? free[Math.floor(random() * free.length)] : null
}

/**
 * In a full workshop, the archetypes prioritised in Inspirations-Modus 2 are offered
 * first: the first free one of `prioritised`, else a random free one.
 */
export function suggestArchetype(
  all: readonly string[],
  prioritised: readonly string[],
  draws: Pick<GroupDraw, 'archetypeId'>[],
  random: () => number = Math.random,
): { archetypeId: string; method: 'priorisiert' | 'random' } | null {
  const free = new Set(availableArchetypes(all, draws))
  const p = prioritised.find((id) => free.has(id))
  if (p) return { archetypeId: p, method: 'priorisiert' }
  const r = drawArchetype(all, draws, random)
  return r ? { archetypeId: r, method: 'random' } : null
}

/** Can `archetypeId` be set manually for `groupNo` (free, or already that group's)? */
export const canAssignArchetype = (
  groupNo: number,
  archetypeId: string,
  draws: Pick<GroupDraw, 'groupNo' | 'archetypeId'>[],
) => !draws.some((d) => d.archetypeId === archetypeId && d.groupNo !== groupNo)
