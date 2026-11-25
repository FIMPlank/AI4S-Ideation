/** A random index in [0, length) that differs from `current` (when there is a choice). */
export function pickDifferent(length: number, current: number, random: () => number = Math.random): number {
  if (length <= 1) return 0
  // pick among the other length-1 indices, so one call is always enough
  const i = Math.floor(random() * (length - 1))
  return i >= current ? i + 1 : i
}
