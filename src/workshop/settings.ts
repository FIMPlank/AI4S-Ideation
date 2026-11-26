import { LIMITS } from './limits'
import type { RoomSettings } from './types'

export const DEFAULT_SETTINGS: RoomSettings = {
  groupCount: 3,
  dotsPerPerson: 3,
  timerPresetsMin: [5, 10, 15, 20],
  klaerung: { enabled: true, minutes: 15 },
  pitch: { enabled: true, minutesPerGroup: 2 },
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

/** Fills gaps and clamps values, so any stored or user-supplied settings are valid. */
export function normalizeSettings(input: Partial<RoomSettings> | null | undefined): RoomSettings {
  const s = input ?? {}
  const d = DEFAULT_SETTINGS
  const presets = Array.isArray(s.timerPresetsMin)
    ? [...new Set(s.timerPresetsMin.map((m) => clampInt(m, 1, 120, 5)))].sort((a, b) => a - b).slice(0, 6)
    : d.timerPresetsMin
  return {
    groupCount: clampInt(s.groupCount, 1, LIMITS.maxGroups, d.groupCount),
    dotsPerPerson: clampInt(s.dotsPerPerson, LIMITS.minDots, LIMITS.maxDots, d.dotsPerPerson),
    timerPresetsMin: presets.length ? presets : d.timerPresetsMin,
    klaerung: {
      enabled: typeof s.klaerung?.enabled === 'boolean' ? s.klaerung.enabled : d.klaerung.enabled,
      minutes: clampInt(s.klaerung?.minutes, 1, 60, d.klaerung.minutes),
    },
    pitch: {
      enabled: typeof s.pitch?.enabled === 'boolean' ? s.pitch.enabled : d.pitch.enabled,
      minutesPerGroup: clampInt(s.pitch?.minutesPerGroup, 1, 15, d.pitch.minutesPerGroup),
    },
  }
}
