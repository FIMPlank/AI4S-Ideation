import { readJson, writeJson, type KeyValueStore } from './storage'

/** Which checklist items are ticked, by item id. */
export type ChecklistState = Record<string, boolean>

export const CHECKLIST_KEY = 'ai4s.leitfaden.ressourcen.v1'

export function toggle(state: ChecklistState, id: string): ChecklistState {
  const next = { ...state }
  if (next[id]) delete next[id]
  else next[id] = true
  return next
}

export const doneCount = (state: ChecklistState, ids: string[]) => ids.filter((id) => state[id]).length

/** Loads saved state, keeping only ids that still exist and only `true` values. */
export function loadChecklist(ids: string[], store?: KeyValueStore): ChecklistState {
  const raw = readJson<unknown>(CHECKLIST_KEY, {}, store)
  if (!raw || typeof raw !== 'object') return {}
  const out: ChecklistState = {}
  for (const id of ids) if ((raw as Record<string, unknown>)[id] === true) out[id] = true
  return out
}

export const saveChecklist = (state: ChecklistState, store?: KeyValueStore) => writeJson(CHECKLIST_KEY, state, store)
