import type { TimerState } from './types'

export const IDLE_TIMER: TimerState = { durationMs: null, endsAt: null, pausedMs: null }

export type TimerAction =
  | { type: 'start'; ms: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'add'; ms: number }
  | { type: 'clear' }

/** Remaining ms (never negative), or null when no timer is set. `now` is server time. */
export function remainingMs(t: TimerState, now: number): number | null {
  if (t.endsAt !== null) return Math.max(0, t.endsAt - now)
  if (t.pausedMs !== null) return Math.max(0, t.pausedMs)
  return null
}

export const isRunning = (t: TimerState) => t.endsAt !== null
export const isPaused = (t: TimerState) => t.endsAt === null && t.pausedMs !== null
export const isExpired = (t: TimerState, now: number) => t.endsAt !== null && t.endsAt <= now

/** Applies a facilitator action. `now` is server time. Same rules as set_timer(). */
export function applyTimer(t: TimerState, action: TimerAction, now: number): TimerState {
  switch (action.type) {
    case 'start':
      return { durationMs: action.ms, endsAt: now + action.ms, pausedMs: null }
    case 'pause':
      return t.endsAt === null ? t : { ...t, endsAt: null, pausedMs: Math.max(0, t.endsAt - now) }
    case 'resume':
      return t.pausedMs === null ? t : { ...t, endsAt: now + t.pausedMs, pausedMs: null }
    case 'add': {
      if (t.endsAt !== null)
        return { ...t, durationMs: (t.durationMs ?? 0) + action.ms, endsAt: Math.max(t.endsAt, now) + action.ms }
      if (t.pausedMs !== null)
        return { ...t, durationMs: (t.durationMs ?? 0) + action.ms, pausedMs: t.pausedMs + action.ms }
      return { durationMs: action.ms, endsAt: now + action.ms, pausedMs: null }
    }
    case 'clear':
      return IDLE_TIMER
  }
}

/** "4:05", "12:00", "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
