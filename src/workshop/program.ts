import { MODES } from '../config/modes'
import { FLOWS, isStepEnabled, stepDef, type StepDef } from './flows'
import type { ModeId, ProgramId, RoomSettings, StepKey } from './types'

/** Order of a full workshop (Leitfaden): Inspirations-Modus 2 → 1 → Strategie-Modus. */
export const FULL_WORKSHOP: readonly ModeId[] = ['inspiration-2', 'inspiration-1', 'strategie']

export const PROGRAM_IDS: readonly ProgramId[] = [...MODES.map((m) => m.id), 'komplett']

export const isProgramId = (v: unknown): v is ProgramId => typeof v === 'string' && PROGRAM_IDS.includes(v as ProgramId)

export const programModes = (program: ProgramId): readonly ModeId[] =>
  program === 'komplett' ? FULL_WORKSHOP : [program]

/** The flat step list of a program: lobby → enabled steps of each mode → ende. */
export function programSteps(program: ProgramId, settings: RoomSettings): StepKey[] {
  const steps = programModes(program).flatMap((m) =>
    FLOWS[m].filter((d) => isStepEnabled(d, settings)).map((d) => d.key),
  )
  return ['lobby', ...steps, 'ende']
}

export const hasStep = (program: ProgramId, settings: RoomSettings, key: StepKey) =>
  programSteps(program, settings).includes(key)

export function nextStep(program: ProgramId, settings: RoomSettings, current: StepKey): StepKey | null {
  const steps = programSteps(program, settings)
  const i = steps.indexOf(current)
  if (i < 0) return steps[1] ?? null
  return steps[i + 1] ?? null
}

export function prevStep(program: ProgramId, settings: RoomSettings, current: StepKey): StepKey | null {
  const steps = programSteps(program, settings)
  const i = steps.indexOf(current)
  return i > 0 ? steps[i - 1] : null
}

export interface RailMode {
  mode: ModeId
  steps: StepDef[]
}

/** Program → modes → steps, for the facilitator's step rail. Includes disabled optional steps. */
export function programRail(program: ProgramId): RailMode[] {
  return programModes(program).map((mode) => ({ mode, steps: [...FLOWS[mode]] }))
}

/** Mode a step belongs to (null for lobby/ende). */
export const modeOfStep = (key: StepKey): ModeId | null => stepDef(key)?.mode ?? null

/** Steps reached so far (inclusive), e.g. to know which results exist. */
export function stepsUpTo(program: ProgramId, settings: RoomSettings, current: StepKey): StepKey[] {
  const steps = programSteps(program, settings)
  const i = steps.indexOf(current)
  return i < 0 ? [] : steps.slice(0, i + 1)
}

/** 0..1 progress through the program. */
export function programProgress(program: ProgramId, settings: RoomSettings, current: StepKey): number {
  const steps = programSteps(program, settings)
  const i = steps.indexOf(current)
  return i < 0 ? 0 : i / (steps.length - 1)
}
