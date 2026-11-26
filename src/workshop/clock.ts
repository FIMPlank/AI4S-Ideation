/** One round trip to server_now(): local send time, server time, local receive time (epoch ms). */
export interface ClockSample {
  sentAt: number
  server: number
  receivedAt: number
}

/**
 * Offset to add to Date.now() to get server time. Uses the sample with the shortest
 * round trip and assumes the server answered halfway (NTP-style).
 */
export function clockOffset(samples: readonly ClockSample[]): number {
  if (!samples.length) return 0
  const best = [...samples].sort((a, b) => a.receivedAt - a.sentAt - (b.receivedAt - b.sentAt))[0]
  return best.server - (best.sentAt + best.receivedAt) / 2
}
