import { getArchetype, getCard } from '../data/deck'
import { t } from '../i18n/de'
import { archetypeSurface } from '../lib/color'
import { displayTitle } from '../lib/cardInfo'
import { cardArchetype } from '../workshop/deckRefs'
import { archetypeOfSelection, type RoomSnapshot, type Selection, type StepKey } from '../workshop'

const r = t.room

export const stepLabel = (key: StepKey) => r.steps[key]

export function stepHelp(key: StepKey, dots: number): string {
  const h = r.stepHelp[key]
  return typeof h === 'function' ? h(dots) : h
}

export function archetypeLabel(id: string | null | undefined): string {
  const a = getArchetype(id)
  return a ? `${r.archetype(a.number)} · ${a.title}` : ''
}

export const archetypeShort = (id: string | null | undefined) => {
  const a = getArchetype(id)
  return a ? r.archetype(a.number) : ''
}

export const cardLabel = (id: string | null | undefined): string => {
  const c = getCard(id ?? '')
  return c ? displayTitle(c) : ''
}

/** Background/text colour of a group: its archetype once drawn, neutral before. */
export function groupSurface(
  snap: Pick<RoomSnapshot, 'draws'>,
  groupNo: number,
): { bg: string; fg: string; archetypeId: string | null } {
  const d = snap.draws.find((x) => x.groupNo === groupNo)
  const a = getArchetype(d?.archetypeId)
  if (!a) return { bg: 'var(--navy)', fg: 'var(--white)', archetypeId: null }
  return { ...archetypeSurface(a.colour), archetypeId: a.id }
}

export function selectionLabel(sel: Pick<Selection, 'refType' | 'refId'>, snap: Pick<RoomSnapshot, 'ideas'>): string {
  if (sel.refType === 'archetype') return archetypeLabel(sel.refId)
  if (sel.refType === 'card') return cardLabel(sel.refId)
  const idea = snap.ideas.find((i) => i.id === sel.refId)
  return idea ? idea.title || r.ideas.untitled : r.ideas.untitled
}

export const selectionArchetype = (sel: Selection, snap: RoomSnapshot) => archetypeOfSelection(sel, snap, cardArchetype)

export const strategyTargets = (snap: RoomSnapshot) =>
  snap.selections.filter((s) => s.kind === 'strategy_target').sort((a, b) => a.position - b.position)

export const relevantArchetypes = (snap: RoomSnapshot) =>
  snap.selections.filter((s) => s.kind === 'relevant_archetype').sort((a, b) => a.position - b.position)

export const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

export const errorText = (reason: string | null) =>
  reason ? ((r.errors as Record<string, string>)[reason] ?? r.errors.generic) : ''
