import { describe, expect, it } from 'vitest'
import { guideCards } from '../data/deck'
import { MODES } from '../config/modes'
import {
  CODE_ALPHABET,
  DEFAULT_SETTINGS,
  FLOWS,
  availableArchetypes,
  balanceGroups,
  bubbleRadius,
  canAssignArchetype,
  clockOffset,
  drawArchetype,
  formatClock,
  generateCode,
  groupSizes,
  isValidCode,
  matrixPoints,
  nextStep,
  normalizeCode,
  normalizeSettings,
  prevStep,
  programRail,
  programSteps,
  rankWithTies,
  remainingMs,
  applyTimer,
  shuffleGroups,
  stat,
  suggestArchetype,
  summarizeRatings,
  tallyVotes,
  IDLE_TIMER,
  type Member,
  type Rating,
  type Selection,
  type Vote,
} from '.'
import { ARCHETYPE_IDS, CASE_REFS, readingOrder } from './deckRefs'

const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('flows', () => {
  it('covers every printed guide step of each mode', () => {
    for (const g of guideCards()) {
      const mode = MODES.find((m) => m.cardMode === g.mode)!
      const covered = FLOWS[mode.id].flatMap((s) => s.guideSteps).sort()
      expect(covered).toEqual(g.steps.map((_, i) => i))
    }
  })
  it('marks Klärungszeit and Pitch as optional Leitfaden additions', () => {
    const extra = Object.values(FLOWS)
      .flat()
      .filter((s) => s.source === 'leitfaden')
    expect(extra.map((s) => [s.key, s.optional])).toEqual([
      ['i1.klaerung', 'klaerung'],
      ['i1.pitch', 'pitch'],
    ])
  })
})

describe('program', () => {
  it('runs a full workshop as Inspirations-Modus 2 → 1 → Strategie', () => {
    const steps = programSteps('komplett', DEFAULT_SETTINGS)
    expect(steps[0]).toBe('lobby')
    expect(steps.at(-1)).toBe('ende')
    expect(steps.indexOf('i2.diskutieren')).toBeLessThan(steps.indexOf('i1.gruppen'))
    expect(steps.indexOf('i1.pitch')).toBeLessThan(steps.indexOf('st.auswaehlen'))
  })
  it('drops switched-off optional steps', () => {
    const s = normalizeSettings({
      klaerung: { enabled: false, minutes: 15 },
      pitch: { enabled: false, minutesPerGroup: 2 },
    })
    const steps = programSteps('inspiration-1', s)
    expect(steps).toEqual(['lobby', 'i1.gruppen', 'i1.ziehen', 'i1.lesen', 'i1.entwickeln', 'ende'])
    expect(nextStep('inspiration-1', s, 'i1.lesen')).toBe('i1.entwickeln')
    expect(prevStep('inspiration-1', s, 'i1.entwickeln')).toBe('i1.lesen')
  })
  it('has no step after ende and none before lobby', () => {
    expect(nextStep('strategie', DEFAULT_SETTINGS, 'ende')).toBeNull()
    expect(prevStep('strategie', DEFAULT_SETTINGS, 'lobby')).toBeNull()
  })
  it('rail lists all steps, including disabled optional ones', () => {
    expect(programRail('komplett').map((r) => r.mode)).toEqual(['inspiration-2', 'inspiration-1', 'strategie'])
    expect(programRail('inspiration-1')[0].steps).toHaveLength(6)
  })
})

describe('settings', () => {
  it('clamps values', () => {
    const s = normalizeSettings({ groupCount: 12, dotsPerPerson: 1, timerPresetsMin: [10, 5, 5, 999] })
    expect(s.groupCount).toBe(7)
    expect(s.dotsPerPerson).toBe(2)
    expect(s.timerPresetsMin).toEqual([5, 10, 120])
  })
  it('fills defaults', () => expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS))
})

describe('codes', () => {
  it('uses no look-alike characters', () => {
    for (const c of '0O1IL') expect(CODE_ALPHABET).not.toContain(c)
  })
  it('generates valid codes and normalizes input', () => {
    expect(isValidCode(generateCode())).toBe(true)
    expect(normalizeCode('abc-23 4')).toBe('ABC234')
    expect(isValidCode('ABC10O')).toBe(false)
  })
})

const member = (id: string, groupNo: number | null, joinedAt: number, role: Member['role'] = 'participant') =>
  ({
    id,
    userId: `u-${id}`,
    role,
    displayName: id,
    groupNo,
    joinedAt,
    lastSeenAt: joinedAt,
    researchConsent: false,
  }) satisfies Member

describe('groups', () => {
  it('keeps assignments and fills the smallest group', () => {
    const ms = [
      member('f', null, 0, 'facilitator'),
      member('a', 1, 1),
      member('b', 1, 2),
      member('c', null, 3),
      member('d', null, 4),
      member('e', 9, 5),
    ]
    const out = balanceGroups(ms, 3)
    expect(out).toEqual({ f: null, a: 1, b: 1, c: 2, d: 3, e: 2 })
  })
  it('shuffles into near-equal groups', () => {
    const ms = Array.from({ length: 10 }, (_, i) => member(`m${i}`, null, i))
    const out = shuffleGroups(ms, 3, seq(0.1, 0.7, 0.3, 0.9))
    const sizes = groupSizes(
      ms.map((m) => ({ ...m, groupNo: out[m.id] })),
      3,
    )
    expect(sizes.sort()).toEqual([3, 3, 4])
  })
})

describe('draw', () => {
  it('never draws an archetype twice', () => {
    const draws: { archetypeId: string }[] = []
    for (let i = 0; i < 7; i++) {
      const a = drawArchetype(ARCHETYPE_IDS, draws, Math.random)!
      expect(draws.map((d) => d.archetypeId)).not.toContain(a)
      draws.push({ archetypeId: a })
    }
    expect(drawArchetype(ARCHETYPE_IDS, draws)).toBeNull()
    expect(availableArchetypes(ARCHETYPE_IDS, draws)).toEqual([])
  })
  it('offers prioritised archetypes first', () => {
    expect(suggestArchetype(ARCHETYPE_IDS, ['a5', 'a2'], [{ archetypeId: 'a5' }])).toEqual({
      archetypeId: 'a2',
      method: 'priorisiert',
    })
    expect(suggestArchetype(ARCHETYPE_IDS, ['a5'], [{ archetypeId: 'a5' }], () => 0)).toEqual({
      archetypeId: 'a1',
      method: 'random',
    })
  })
  it('allows manual override only for free archetypes', () => {
    const draws = [{ groupNo: 1, archetypeId: 'a3' }]
    expect(canAssignArchetype(2, 'a3', draws)).toBe(false)
    expect(canAssignArchetype(1, 'a3', draws)).toBe(true)
    expect(canAssignArchetype(2, 'a4', draws)).toBe(true)
  })
})

describe('tally', () => {
  it('ranks with ties (1, 1, 3)', () => {
    const r = rankWithTies(['x', 'y', 'z', 'w'], (s) => ({ x: 2, y: 5, z: 5, w: 1 })[s]!)
    expect(r.map((e) => [e.item, e.rank])).toEqual([
      ['y', 1],
      ['z', 1],
      ['x', 3],
      ['w', 4],
    ])
  })
  it('counts dots per case and archetype', () => {
    const [c1, c2, , , c5] = CASE_REFS
    const votes: Vote[] = [
      { id: '1', userId: 'u1', cardId: c1.id },
      { id: '2', userId: 'u2', cardId: c1.id },
      { id: '3', userId: 'u2', cardId: c5.id },
      { id: '4', userId: 'u2', cardId: c1.id }, // duplicate
      { id: '5', userId: 'u3', cardId: 'a1-archetype' }, // not a case
      { id: '6', userId: 'u3', cardId: c2.id },
    ]
    const t = tallyVotes(votes, CASE_REFS, ARCHETYPE_IDS)
    expect(t.byCase[0]).toMatchObject({ cardId: c1.id, dots: 2, rank: 1 })
    expect(t.totalDots).toBe(4)
    expect(t.voters).toBe(3)
    expect(t.maxCaseDots).toBe(2)
    expect(t.byArchetype[0]).toMatchObject({ archetypeId: c1.archetypeId, dots: 3, rank: 1 })
    expect(t.byArchetype[0].cases).toHaveLength(4)
    expect(t.byArchetype[1]).toMatchObject({ archetypeId: c5.archetypeId, dots: 1, rank: 2 })
    expect(t.byArchetype.at(-1)!.rank).toBe(3) // all zero-dot archetypes tie
  })
  it('works without votes', () => {
    const t = tallyVotes([], CASE_REFS, ARCHETYPE_IDS)
    expect(t.maxCaseDots).toBe(0)
    expect(new Set(t.byCase.map((c) => c.rank))).toEqual(new Set([1]))
  })
})

describe('ratings and matrix', () => {
  const sel = (id: string, position: number): Selection => ({
    id,
    kind: 'strategy_target',
    refType: 'archetype',
    refId: 'a1',
    position,
  })
  const r = (userId: string, selectionId: string, criterion: Rating['criterion'], score: number): Rating => ({
    id: `${userId}${selectionId}${criterion}`,
    userId,
    selectionId,
    criterion,
    score,
  })
  it('computes mean and spread', () => {
    expect(stat([1, 3, 5])).toMatchObject({ n: 3, mean: 3, min: 1, max: 5 })
    expect(stat([1, 3, 5]).sd).toBeCloseTo(1.633, 3)
    expect(stat([])).toEqual({ n: 0, mean: null, min: null, max: null, sd: null })
  })
  it('summarizes per criterion and builds matrix points', () => {
    const ratings = [
      r('u1', 's1', 'umsetzbarkeit', 4),
      r('u2', 's1', 'umsetzbarkeit', 2),
      r('u1', 's1', 'geschaeftsnutzen', 5),
      r('u1', 's1', 'nachhaltigkeit', 3),
      r('u1', 's2', 'umsetzbarkeit', 5),
    ]
    const sum = summarizeRatings(ratings, 's1')
    expect(sum.raters).toBe(2)
    expect(sum.umsetzbarkeit.mean).toBe(3)
    const pts = matrixPoints([sel('s2', 1), sel('s1', 0)], ratings)
    expect(pts).toEqual([{ selectionId: 's1', x: 3, y: 5, size: 3, raters: 2 }]) // s2 incomplete
  })
  it('grows bubble area with the value', () => {
    expect(bubbleRadius(1)).toBe(10)
    expect(bubbleRadius(5)).toBe(34)
    expect(bubbleRadius(3)).toBeGreaterThan(bubbleRadius(2))
  })
})

describe('timer', () => {
  it('starts, pauses, resumes and adds time', () => {
    let t = applyTimer(IDLE_TIMER, { type: 'start', ms: 60_000 }, 1000)
    expect(remainingMs(t, 31_000)).toBe(30_000)
    t = applyTimer(t, { type: 'pause' }, 31_000)
    expect(remainingMs(t, 99_000)).toBe(30_000)
    t = applyTimer(t, { type: 'add', ms: 60_000 }, 99_000)
    expect(remainingMs(t, 99_000)).toBe(90_000)
    t = applyTimer(t, { type: 'resume' }, 100_000)
    expect(remainingMs(t, 110_000)).toBe(80_000)
    expect(remainingMs(t, 999_000)).toBe(0)
    expect(remainingMs(applyTimer(t, { type: 'clear' }, 0), 0)).toBeNull()
  })
  it('adds time after expiry from now', () => {
    const t = applyTimer({ durationMs: 1000, endsAt: 1000, pausedMs: null }, { type: 'add', ms: 60_000 }, 5000)
    expect(t.endsAt).toBe(65_000)
  })
  it('formats', () => {
    expect(formatClock(245_000)).toBe('4:05')
    expect(formatClock(3_723_000)).toBe('1:02:03')
    expect(formatClock(400)).toBe('0:01')
  })
})

describe('clock offset', () => {
  it('uses the shortest round trip', () => {
    expect(
      clockOffset([
        { sentAt: 0, server: 5000, receivedAt: 400 },
        { sentAt: 1000, server: 5550, receivedAt: 1100 },
      ]),
    ).toBe(4500)
    expect(clockOffset([])).toBe(0)
  })
})

describe('deck refs', () => {
  it('has 28 cases and the reading order of an archetype', () => {
    expect(CASE_REFS).toHaveLength(28)
    const o = readingOrder('a3')
    expect(o.overview).toHaveLength(1)
    expect(o.properties).toHaveLength(2)
    expect(o.cases).toHaveLength(4)
  })
})
