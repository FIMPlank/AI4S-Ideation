/**
 * Demo-Raum: a full workshop in one browser. A MemoryServer plus simulated
 * participants who join, vote, write ideas and rate when the facilitator
 * reaches the matching step. Nothing leaves the browser.
 */
import { CASE_REFS, readingOrder } from '../workshop/deckRefs'
import { CRITERIA, DEFAULT_SETTINGS, type RoomSnapshot, type StepKey } from '../workshop'
import { MemoryServer, type MemoryStore } from '../workshop/store/memory'
import { t } from '../i18n/de'

const FAC = 'demo-facilitator'
const PHONE = 'demo-phone'

export class DemoRoom {
  readonly server = new MemoryServer()
  facilitator!: MemoryStore
  phone!: MemoryStore
  private bots: { name: string; store: MemoryStore; done: Set<string> }[] = []
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private unlisten: (() => void) | null = null
  private roomId = ''
  private code = ''
  private ready: Promise<void>

  constructor() {
    this.ready = this.init()
  }

  private async init() {
    const created = await this.server.client(FAC).createRoom({
      title: 'Demo-Workshop',
      program: 'komplett',
      settings: { ...DEFAULT_SETTINGS, groupCount: 3 },
    })
    this.code = created.code
    this.roomId = created.roomId
    this.facilitator = await this.server.client(FAC).openRoom(this.code)
    this.phone = await this.server.client(PHONE).openRoom(this.code)
    t.room.demo.bots.forEach((name, i) => {
      this.later(600 + i * 700, async () => {
        const store = await this.server.client(`demo-bot-${i}`).openRoom(this.code)
        await store.join(name)
        this.bots.push({ name, store, done: new Set() })
        this.react()
      })
    })
    this.unlisten = this.server.listen(this.roomId, () => this.react())
  }

  /** Store for a view: the phone view is a participant, the rest is the facilitator. */
  async store(view: 'teilnehmer' | 'moderation' | 'leinwand' | 'ergebnis'): Promise<MemoryStore> {
    await this.ready
    return view === 'teilnehmer' ? this.phone : this.facilitator
  }

  dispose() {
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    this.unlisten?.()
    this.facilitator?.dispose()
    this.phone?.dispose()
    for (const b of this.bots) b.store.dispose()
  }

  private later(ms: number, fn: () => Promise<unknown> | void) {
    const id = setTimeout(() => {
      this.timers.delete(id)
      Promise.resolve(fn()).catch(() => {
        /* a bot losing a race (e.g. step changed) is fine */
      })
    }, ms)
    this.timers.add(id)
  }

  private get raw(): RoomSnapshot | undefined {
    return this.server.raw(this.roomId)
  }

  /** Each bot acts once per step. */
  private react() {
    const snap = this.raw
    if (!snap || snap.room.status === 'closed') return
    const step = snap.room.stepKey
    this.bots.forEach((bot, i) => {
      const key = `${step}:${snap.room.pitchGroup ?? ''}`
      if (bot.done.has(key)) return
      const me = snap.members.find((m) => m.userId === `demo-bot-${i}`)
      if (!me) return
      if (step === 'i1.entwickeln' && me.groupNo === null) return
      if (step === 'st.bewerten' && !snap.selections.some((s) => s.kind === 'strategy_target')) return
      bot.done.add(key)
      this.act(step, bot.store, i, me.groupNo)
    })
  }

  private act(step: StepKey, store: MemoryStore, i: number, groupNo: number | null) {
    const pause = (n: number) => 1200 + n * 900 + Math.random() * 1500
    switch (step) {
      case 'i2.markieren': {
        // favour a few archetypes, so the heatmap tells a story
        const pool = CASE_REFS.filter((c, k) => ['a2', 'a3', 'a5'].includes(c.archetypeId) || k % 5 === i)
        const picks = shuffle(pool).slice(0, DEFAULT_SETTINGS.dotsPerPerson)
        picks.forEach((c, k) => this.later(pause(i + k), () => store.toggleVote(c.id)))
        break
      }
      case 'i2.diskutieren':
        if (i < 2)
          this.later(pause(i), () =>
            store.addNote({ stepKey: step, topic: i ? 'uebertragbar' : 'relevant', body: t.room.demo.botNotes[i] }),
          )
        break
      case 'i1.ziehen':
        if (groupNo)
          this.later(6000 + i * 800, () =>
            this.raw?.draws.some((d) => d.groupNo === groupNo) ? undefined : store.draw(groupNo),
          )
        break
      case 'i1.entwickeln': {
        if (!groupNo) break
        const firstInGroup = this.raw!.members.filter(
          (m) => m.groupNo === groupNo && m.userId.startsWith('demo-bot-'),
        ).sort((a, b) => a.joinedAt - b.joinedAt)[0]
        if (firstInGroup?.userId !== `demo-bot-${i}`) break
        const draw = this.raw!.draws.find((d) => d.groupNo === groupNo)
        const cases = draw ? readingOrder(draw.archetypeId).cases : []
        const ideas = t.room.demo.botIdeas
        this.later(pause(groupNo), async () => {
          const id = await store.saveIdea({
            groupNo,
            title: ideas[((groupNo - 1) * 2) % ideas.length],
            inspiredBy: cases[0] ?? null,
          })
          this.later(2500, () =>
            store.saveIdea({
              id,
              groupNo,
              description: 'Erste Skizze: Daten aus bestehenden Systemen nutzen, Pilot in einem Bereich.',
              target: 'Produktion',
            }),
          )
        })
        this.later(pause(groupNo) + 7000, () =>
          store.saveIdea({
            groupNo,
            title: ideas[((groupNo - 1) * 2 + 1) % ideas.length],
            inspiredBy: cases[1] ?? null,
          }),
        )
        break
      }
      case 'st.bewerten': {
        const targets = this.raw!.selections.filter((s) => s.kind === 'strategy_target')
        targets.forEach((s, k) =>
          CRITERIA.forEach((c, j) =>
            this.later(pause(i) + (k * 3 + j) * 300, () => store.rate(s.id, c, 2 + ((i + j + k) % 4))),
          ),
        )
        break
      }
      case 'st.umsetzung': {
        const first = this.raw!.selections.find((s) => s.kind === 'strategy_target')
        if (first && i === 0)
          this.later(pause(1), () =>
            store.saveImplStep({ selectionId: first.id, what: 'Datenquellen sichten', who: 'IT-Leitung' }),
          )
        break
      }
      default:
        break
    }
  }
}

function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

let current: DemoRoom | null = null

export function demoRoom(): DemoRoom {
  return (current ??= new DemoRoom())
}

export function restartDemo(): DemoRoom {
  current?.dispose()
  current = new DemoRoom()
  return current
}
