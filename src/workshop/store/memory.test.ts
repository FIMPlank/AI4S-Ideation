import { beforeEach, describe, expect, it } from 'vitest'
import { CASE_REFS, ARCHETYPE_IDS } from '../deckRefs'
import { DEFAULT_SETTINGS } from '../settings'
import { prioritisedArchetypes, strategyCandidates, archetypeOfSelection } from '../carry'
import { voteProgress, ratingProgress } from '../progress'
import { cardArchetype } from '../deckRefs'
import { MemoryServer, type MemoryStore } from './memory'

let clock = 1_000_000
let server: MemoryServer
let fac: MemoryStore
let anna: MemoryStore
let ben: MemoryStore
let code: string
let secret: string

const snap = (s: MemoryStore) => s.getState().snapshot!
const [case1, case2, case3, case4, case5] = CASE_REFS.map((c) => c.id)

async function setup(program: 'komplett' | 'inspiration-2' = 'komplett') {
  let n = 0
  server = new MemoryServer({ now: () => clock, random: () => 0, id: () => `id${++n}` })
  const created = await server
    .client('u-fac')
    .createRoom({ title: 'Test', program, settings: { ...DEFAULT_SETTINGS, groupCount: 2 } })
  code = created.code
  secret = created.facilitatorSecret
  fac = await server.client('u-fac').openRoom(code)
  anna = await server.client('u-anna').openRoom(code)
  ben = await server.client('u-ben').openRoom(code)
  await anna.join('Anna')
  await ben.join('Ben')
}

/** Moves the room forward to `key`, step by step. */
async function goTo(key: string) {
  const { programSteps } = await import('../program')
  const s = snap(fac).room
  const steps = programSteps(s.program, s.settings)
  while (snap(fac).room.stepKey !== key) {
    const cur = snap(fac).room.stepKey
    await fac.setStep(cur, steps[steps.indexOf(cur) + 1])
  }
}

beforeEach(() => setup())

describe('MemoryStore: membership', () => {
  it('a non-member sees nothing until joining', async () => {
    const eve = await server.client('u-eve').openRoom(code)
    expect(eve.getState().snapshot).toBeNull()
    await eve.join('  Eve  ')
    expect(snap(eve).members.find((m) => m.userId === 'u-eve')?.displayName).toBe('Eve')
  })
  it('rejects unknown codes and too long names', async () => {
    const x = await server.client('u-x').openRoom('ZZZZZZ')
    await expect(x.join('X')).rejects.toMatchObject({ reason: 'not-found' })
    const y = await server.client('u-y').openRoom(code)
    await expect(y.join('x'.repeat(41))).rejects.toMatchObject({ reason: 'too-long' })
    expect(y.getState().lastError).toBe('too-long')
  })
  it('rejoining keeps the same membership', async () => {
    await anna.join('Anna B.')
    expect(snap(fac).members.filter((m) => m.userId === 'u-anna')).toHaveLength(1)
  })
  it('the facilitator link makes another device facilitator', async () => {
    const laptop2 = await server.client('u-laptop2').openRoom(code)
    await expect(laptop2.claimFacilitator('wrong')).rejects.toMatchObject({ reason: 'not-found' })
    await laptop2.claimFacilitator(secret)
    expect(laptop2.getState().me.role).toBe('facilitator')
    await laptop2.setStep('lobby', 'i2.lesen')
    expect(snap(fac).room.stepKey).toBe('i2.lesen')
  })
})

describe('MemoryStore: room state', () => {
  it('only the facilitator changes the step', async () => {
    await expect(anna.setStep('lobby', 'i2.lesen')).rejects.toMatchObject({ reason: 'not-facilitator' })
    await expect(anna.timer({ type: 'start', ms: 60_000 })).rejects.toMatchObject({ reason: 'not-facilitator' })
    await expect(anna.reveal('i2.markieren')).rejects.toMatchObject({ reason: 'not-facilitator' })
  })
  it('a stale expected step cannot advance twice', async () => {
    await fac.setStep('lobby', 'i2.lesen')
    await expect(fac.setStep('lobby', 'i2.lesen')).rejects.toMatchObject({ reason: 'stale-step' })
    expect(snap(fac).room.status).toBe('running')
  })
  it('rejects steps outside the program', async () => {
    await setup('inspiration-2')
    await expect(fac.setStep('lobby', 'st.bewerten')).rejects.toMatchObject({ reason: 'invalid' })
  })
  it('timer runs on server time and resets on step change', async () => {
    await fac.timer({ type: 'start', ms: 300_000 })
    expect(snap(anna).room.timer.endsAt).toBe(clock + 300_000)
    await fac.setStep('lobby', 'i2.lesen')
    expect(snap(anna).room.timer.endsAt).toBeNull()
  })
  it('closed rooms are read-only', async () => {
    await fac.closeRoom()
    await expect(anna.addNote({ stepKey: 'lobby', topic: 'x', body: 'hi' })).rejects.toMatchObject({ reason: 'closed' })
    await expect(fac.setStep('lobby', 'i2.lesen')).rejects.toMatchObject({ reason: 'closed' })
    expect(snap(anna).room.status).toBe('closed')
  })
})

describe('MemoryStore: dot voting', () => {
  beforeEach(() => goTo('i2.markieren'))

  it('hides others’ votes until reveal; progress shows counts', async () => {
    await anna.toggleVote(case1)
    await anna.toggleVote(case2)
    await anna.toggleVote(case3)
    await ben.toggleVote(case1)
    expect(snap(ben).votes.map((v) => v.userId)).toEqual(['u-ben'])
    expect(snap(fac).votes).toHaveLength(0)
    expect(voteProgress(server.raw(snap(fac).room.id)!.members, server.raw(snap(fac).room.id)!.votes, 3)).toEqual({
      done: 1,
      total: 2,
    })
    await goTo('i2.aufloesen')
    expect(snap(ben).votes).toHaveLength(4)
    expect(snap(fac).room.revealed).toContain('i2.markieren')
  })
  it('enforces the dot budget and toggles off', async () => {
    for (const c of [case1, case2, case3]) await anna.toggleVote(c)
    await expect(anna.toggleVote(case4)).rejects.toMatchObject({ reason: 'no-dots-left' })
    await anna.toggleVote(case1)
    await anna.toggleVote(case4)
    expect(
      snap(anna)
        .votes.map((v) => v.cardId)
        .sort(),
    ).toEqual([case2, case3, case4].sort())
  })
  it('only case cards, only in the voting step', async () => {
    await expect(anna.toggleVote('a1-archetype')).rejects.toMatchObject({ reason: 'not-case' })
    await goTo('i2.aufloesen')
    await expect(anna.toggleVote(case5)).rejects.toMatchObject({ reason: 'wrong-step' })
  })
})

describe('MemoryStore: groups, draws and ideas', () => {
  beforeEach(async () => {
    await goTo('i1.gruppen')
    const s = snap(fac)
    const a = s.members.find((m) => m.userId === 'u-anna')!
    const b = s.members.find((m) => m.userId === 'u-ben')!
    await fac.setGroups({ [a.id]: 1, [b.id]: 2 })
    await goTo('i1.ziehen')
  })

  it('a group member draws for their own group only, without duplicates', async () => {
    await expect(anna.draw(2)).rejects.toMatchObject({ reason: 'not-your-group' })
    await anna.draw(1)
    await expect(anna.draw(1)).rejects.toMatchObject({ reason: 'taken' })
    await ben.draw(2)
    const ids = snap(fac).draws.map((d) => d.archetypeId)
    expect(new Set(ids).size).toBe(2)
  })
  it('manual override respects uniqueness', async () => {
    await fac.setDraw(1, 'a4')
    await expect(fac.setDraw(2, 'a4')).rejects.toMatchObject({ reason: 'taken' })
    await fac.setDraw(1, 'a5', 'priorisiert')
    await fac.setDraw(2, 'a4')
    expect(snap(ben).draws.map((d) => [d.groupNo, d.archetypeId, d.method])).toEqual([
      [1, 'a5', 'priorisiert'],
      [2, 'a4', 'manual'],
    ])
  })
  it('only the own group edits its ideas; limits apply', async () => {
    const id = await anna.saveIdea({ groupNo: 1, title: 'Digitaler Zwilling', inspiredBy: case1 })
    await expect(ben.saveIdea({ id, groupNo: 1, title: 'hijack' })).rejects.toMatchObject({ reason: 'not-your-group' })
    await expect(ben.saveIdea({ groupNo: 1, title: 'x' })).rejects.toMatchObject({ reason: 'not-your-group' })
    await expect(anna.saveIdea({ groupNo: 1, title: 'x'.repeat(121) })).rejects.toMatchObject({ reason: 'too-long' })
    await expect(anna.saveIdea({ groupNo: 1, inspiredBy: 'a1-archetype' })).rejects.toMatchObject({
      reason: 'not-case',
    })
    await fac.saveIdea({ id, groupNo: 1, description: 'ergänzt' })
    expect(snap(ben).ideas[0]).toMatchObject({ title: 'Digitaler Zwilling', description: 'ergänzt' })
    for (let i = 1; i < 20; i++) await anna.saveIdea({ groupNo: 1, title: `Idee ${i}` })
    await expect(anna.saveIdea({ groupNo: 1, title: 'zu viel' })).rejects.toMatchObject({ reason: 'too-many-ideas' })
  })
})

describe('MemoryStore: strategy and carry-over', () => {
  it('carries prioritised archetypes and ideas into the Strategie-Modus', async () => {
    await goTo('i2.markieren')
    await anna.toggleVote(case5) // a2
    await ben.toggleVote(case5)
    await ben.toggleVote(case1) // a1
    await goTo('i2.diskutieren')
    const fromDots = prioritisedArchetypes(snap(fac), CASE_REFS, ARCHETYPE_IDS)
    expect(fromDots).toEqual(['a2', 'a1'])
    await fac.select('relevant_archetype', 'archetype', 'a3')
    expect(prioritisedArchetypes(snap(fac), CASE_REFS, ARCHETYPE_IDS)).toEqual(['a3'])
    const c = strategyCandidates(snap(fac), CASE_REFS, ARCHETYPE_IDS)
    expect(c.topCases).toEqual([case5, case1])
  })

  it('rates privately, reveals mean and spread, plans steps', async () => {
    await goTo('st.auswaehlen')
    const s1 = await fac.select('strategy_target', 'archetype', 'a2')
    expect(await fac.select('strategy_target', 'archetype', 'a2')).toBe(s1) // no duplicates
    await expect(anna.rate(s1, 'umsetzbarkeit', 4)).rejects.toMatchObject({ reason: 'wrong-step' })
    await goTo('st.bewerten')
    await expect(anna.rate(s1, 'umsetzbarkeit', 6)).rejects.toMatchObject({ reason: 'invalid' })
    for (const [c, v] of [
      ['umsetzbarkeit', 4],
      ['geschaeftsnutzen', 3],
      ['nachhaltigkeit', 5],
    ] as const) {
      await anna.rate(s1, c, v)
      await ben.rate(s1, c, v - 1)
    }
    await anna.rate(s1, 'umsetzbarkeit', 5) // change own rating
    expect(snap(ben).ratings.every((r) => r.userId === 'u-ben')).toBe(true)
    const raw = server.raw(snap(fac).room.id)!
    expect(ratingProgress(raw.members, raw.ratings, raw.selections)).toEqual({ done: 2, total: 2 })
    await fac.reveal('st.bewerten')
    expect(snap(ben).ratings).toHaveLength(6)
    await goTo('st.umsetzung')
    const stepId = await anna.saveImplStep({
      selectionId: s1,
      what: 'Datenquellen sichten',
      who: 'IT-Leitung',
      due: '2027-01-31',
    })
    await expect(ben.saveImplStep({ id: stepId, selectionId: s1, what: 'x' })).rejects.toMatchObject({
      reason: 'not-member',
    })
    await expect(anna.saveImplStep({ selectionId: s1, due: '31.01.2027' })).rejects.toMatchObject({ reason: 'invalid' })
    expect(archetypeOfSelection(snap(fac).selections[0], snap(fac), cardArchetype)).toBe('a2')
    await fac.unselect(s1)
    expect(snap(fac).implSteps).toHaveLength(0)
    expect(snap(fac).ratings).toHaveLength(0)
  })
})

describe('MemoryServer: expiry', () => {
  it('deletes rooms after 30 days', async () => {
    clock += 29 * 86_400_000
    expect(server.expire()).toBe(0)
    clock += 2 * 86_400_000
    expect(server.expire()).toBe(1)
    expect(server.roomIdByCode(code)).toBeUndefined()
  })
})
