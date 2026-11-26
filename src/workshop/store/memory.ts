/**
 * In-memory backend: one MemoryServer holds the truth for all rooms, each
 * MemoryStore is one browser (one anonymous user). Enforces the same rules as
 * the database (see ../rules.ts), so tests and the Demo-Raum behave like live rooms.
 */
import { CODE_ALPHABET, generateCode, normalizeCode } from '../codes'
import { isCaseCard, ARCHETYPE_IDS } from '../deckRefs'
import { canAssignArchetype, drawArchetype } from '../draw'
import { stepDef } from '../flows'
import { balanceGroups } from '../groups'
import { LIMITS } from '../limits'
import { hasStep } from '../program'
import {
  WorkshopError,
  assertFacilitator,
  assertWritable,
  canDraw,
  canEditGroup,
  checkDisplayName,
  checkLength,
  checkRating,
  checkVote,
  visibleTo,
} from '../rules'
import { normalizeSettings } from '../settings'
import { applyTimer, IDLE_TIMER, type TimerAction } from '../timer'
import type {
  Criterion,
  DrawMethod,
  Me,
  Member,
  RefType,
  Room,
  RoomSettings,
  RoomSnapshot,
  SelectionKind,
  StepKey,
} from '../types'
import type {
  ConnectionState,
  CreateRoomInput,
  CreatedRoom,
  IdeaInput,
  ImplStepInput,
  NoteInput,
  StoreState,
  WorkshopBackend,
  WorkshopStore,
} from './types'

const DAY = 24 * 60 * 60 * 1000

export interface MemoryServerOptions {
  now?: () => number
  random?: () => number
  id?: () => string
}

interface StoredRoom {
  data: RoomSnapshot
  secret: string
}

export class MemoryServer {
  private rooms = new Map<string, StoredRoom>()
  private byCode = new Map<string, string>()
  private listeners = new Map<string, Set<() => void>>()
  readonly now: () => number
  readonly random: () => number
  private nextId: () => string

  constructor(opts: MemoryServerOptions = {}) {
    this.now = opts.now ?? Date.now
    this.random = opts.random ?? Math.random
    let n = 0
    this.nextId =
      opts.id ?? (() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${++n}`))
  }

  /** A browser with its own anonymous identity. */
  client(userId: string = this.nextId()): MemoryClient {
    return new MemoryClient(this, userId)
  }

  // --- reading -------------------------------------------------------------

  roomIdByCode(code: string): string | undefined {
    return this.byCode.get(normalizeCode(code))
  }

  me(roomId: string, userId: string): Me {
    const m = this.rooms.get(roomId)?.data.members.find((x) => x.userId === userId)
    return { userId, memberId: m?.id ?? null, role: m?.role ?? null, groupNo: m?.groupNo ?? null }
  }

  /** What `userId` may read (null for non-members, like RLS). */
  snapshotFor(roomId: string, userId: string): RoomSnapshot | null {
    const r = this.rooms.get(roomId)
    if (!r) return null
    const me = this.me(roomId, userId)
    return me.memberId ? visibleTo(r.data, me) : null
  }

  /** Full data, bypassing visibility (tests and the demo simulator only). */
  raw(roomId: string): RoomSnapshot | undefined {
    return this.rooms.get(roomId)?.data
  }

  listen(roomId: string, fn: () => void): () => void {
    let set = this.listeners.get(roomId)
    if (!set) this.listeners.set(roomId, (set = new Set()))
    set.add(fn)
    return () => set.delete(fn)
  }

  // --- RPCs ----------------------------------------------------------------

  createRoom(userId: string, input: CreateRoomInput): CreatedRoom {
    let code = generateCode(this.random)
    for (let i = 0; this.byCode.has(code); i++) {
      if (i > 50) throw new WorkshopError('invalid', 'no free code')
      code = generateCode(this.random)
    }
    const now = this.now()
    const id = this.nextId()
    const room: Room = {
      id,
      code,
      title: checkLength(input.title, LIMITS.roomTitle),
      program: input.program,
      settings: normalizeSettings(input.settings),
      status: 'lobby',
      stepKey: 'lobby',
      stepStartedAt: now,
      timer: IDLE_TIMER,
      revealed: [],
      pitchGroup: null,
      createdAt: now,
      expiresAt: now + 30 * DAY,
      researchMode: false,
    }
    const facilitator: Member = {
      id: this.nextId(),
      userId,
      role: 'facilitator',
      displayName: 'Moderation',
      groupNo: null,
      joinedAt: now,
      lastSeenAt: now,
      researchConsent: false,
    }
    const secret = Array.from(
      { length: 32 },
      () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)],
    ).join('')
    const data: RoomSnapshot = {
      room,
      members: [facilitator],
      draws: [],
      ideas: [],
      votes: [],
      ratings: [],
      notes: [],
      selections: [],
      implSteps: [],
    }
    this.rooms.set(id, { data, secret })
    this.byCode.set(code, id)
    this.emit(id)
    return { roomId: id, code, facilitatorSecret: secret }
  }

  join(code: string, userId: string, displayName: string): void {
    const roomId = this.roomIdByCode(code)
    const r = roomId ? this.rooms.get(roomId) : undefined
    if (!r || !roomId) throw new WorkshopError('not-found')
    const name = checkDisplayName(displayName)
    const existing = r.data.members.find((m) => m.userId === userId)
    if (existing) {
      if (r.data.room.status !== 'closed') existing.displayName = name
      return this.emit(roomId)
    }
    if (r.data.room.status === 'closed') throw new WorkshopError('closed')
    if (r.data.members.filter((m) => m.role === 'participant').length >= LIMITS.participantsPerRoom)
      throw new WorkshopError('room-full')
    const now = this.now()
    r.data.members.push({
      id: this.nextId(),
      userId,
      role: 'participant',
      displayName: name,
      groupNo: null,
      joinedAt: now,
      lastSeenAt: now,
      researchConsent: false,
    })
    this.emit(roomId)
  }

  claimFacilitator(code: string, userId: string, secret: string): void {
    const roomId = this.roomIdByCode(code)
    const r = roomId ? this.rooms.get(roomId) : undefined
    if (!r || !roomId || r.secret !== secret) throw new WorkshopError('not-found')
    const existing = r.data.members.find((m) => m.userId === userId)
    if (existing) {
      existing.role = 'facilitator'
      existing.groupNo = null
    } else {
      const now = this.now()
      r.data.members.push({
        id: this.nextId(),
        userId,
        role: 'facilitator',
        displayName: 'Moderation',
        groupNo: null,
        joinedAt: now,
        lastSeenAt: now,
        researchConsent: false,
      })
    }
    this.emit(roomId)
  }

  /** Runs `fn` on the room's data as `userId` and notifies listeners. */
  mutate<T>(roomId: string, userId: string, fn: (d: RoomSnapshot, me: Me) => T): T {
    const r = this.rooms.get(roomId)
    if (!r) throw new WorkshopError('not-found')
    const out = fn(r.data, this.me(roomId, userId))
    this.emit(roomId)
    return out
  }

  newId(): string {
    return this.nextId()
  }

  /** Deletes rooms older than 30 days (the pg_cron job). Returns how many. */
  expire(): number {
    let n = 0
    for (const [id, r] of this.rooms) {
      if (r.data.room.expiresAt <= this.now()) {
        this.rooms.delete(id)
        this.byCode.delete(r.data.room.code)
        n++
        this.emit(id)
      }
    }
    return n
  }

  private emit(roomId: string) {
    for (const fn of this.listeners.get(roomId) ?? []) fn()
  }
}

export class MemoryClient implements WorkshopBackend {
  readonly server: MemoryServer
  readonly userId: string
  constructor(server: MemoryServer, userId: string) {
    this.server = server
    this.userId = userId
  }
  async createRoom(input: CreateRoomInput): Promise<CreatedRoom> {
    return this.server.createRoom(this.userId, input)
  }
  async openRoom(code: string): Promise<MemoryStore> {
    return new MemoryStore(this.server, this.userId, normalizeCode(code))
  }
}

export class MemoryStore implements WorkshopStore {
  private server: MemoryServer
  private userId: string
  private code: string
  private state: StoreState
  private listeners = new Set<() => void>()
  private unlisten: (() => void) | null = null

  constructor(server: MemoryServer, userId: string, code: string) {
    this.server = server
    this.userId = userId
    this.code = code
    this.state = {
      snapshot: null,
      me: { userId, memberId: null, role: null, groupNo: null },
      connection: 'live',
      ready: true,
      lastError: null,
    }
    this.attach()
    this.refresh()
  }

  private get roomId(): string | undefined {
    return this.server.roomIdByCode(this.code)
  }

  private attach() {
    const id = this.roomId
    if (id && !this.unlisten) this.unlisten = this.server.listen(id, () => this.refresh())
  }

  private refresh() {
    const id = this.roomId
    const me = id ? this.server.me(id, this.userId) : this.state.me
    const snapshot = id ? this.server.snapshotFor(id, this.userId) : null
    this.state = { ...this.state, me, snapshot }
    for (const fn of this.listeners) fn()
  }

  getState = (): StoreState => this.state
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  serverNow = (): number => this.server.now()
  dispose(): void {
    this.unlisten?.()
    this.unlisten = null
    this.listeners.clear()
  }

  /** For the demo: show the reconnect state. */
  setConnection(connection: ConnectionState): void {
    this.state = { ...this.state, connection }
    for (const fn of this.listeners) fn()
  }

  private async run<T>(fn: () => T): Promise<T> {
    try {
      const out = fn()
      if (this.state.lastError) this.state = { ...this.state, lastError: null }
      this.refresh()
      return out
    } catch (e) {
      if (e instanceof WorkshopError) {
        this.state = { ...this.state, lastError: e.reason }
        for (const l of this.listeners) l()
      }
      throw e
    }
  }

  private mutate<T>(fn: (d: RoomSnapshot, me: Me) => T): Promise<T> {
    return this.run(() => {
      const id = this.roomId
      if (!id) throw new WorkshopError('not-found')
      return this.server.mutate(id, this.userId, fn)
    })
  }

  private facilitator<T>(fn: (d: RoomSnapshot, me: Me) => T): Promise<T> {
    return this.mutate((d, me) => {
      assertFacilitator(d.room, me)
      return fn(d, me)
    })
  }

  private writable<T>(fn: (d: RoomSnapshot, me: Me) => T): Promise<T> {
    return this.mutate((d, me) => {
      assertWritable(d.room, me)
      return fn(d, me)
    })
  }

  // --- membership ----------------------------------------------------------

  join(displayName: string): Promise<void> {
    return this.run(() => {
      this.server.join(this.code, this.userId, displayName)
      this.attach()
    })
  }

  rename(displayName: string): Promise<void> {
    return this.writable((d, me) => {
      d.members.find((m) => m.id === me.memberId)!.displayName = checkDisplayName(displayName)
    })
  }

  claimFacilitator(secret: string): Promise<void> {
    return this.run(() => {
      this.server.claimFacilitator(this.code, this.userId, secret)
      this.attach()
    })
  }

  // --- facilitator -----------------------------------------------------------

  setStep(expected: StepKey, next: StepKey): Promise<void> {
    return this.facilitator((d) => {
      if (d.room.stepKey !== expected) throw new WorkshopError('stale-step')
      if (!hasStep(d.room.program, d.room.settings, next)) throw new WorkshopError('invalid')
      d.room.stepKey = next
      d.room.stepStartedAt = this.server.now()
      d.room.timer = IDLE_TIMER
      d.room.pitchGroup = next === 'i1.pitch' ? (d.room.pitchGroup ?? 1) : null
      if (next !== 'lobby' && d.room.status === 'lobby') d.room.status = 'running'
      // entering a reveal step reveals the step before it
      if (stepDef(next)?.kind === 'reveal' && !d.room.revealed.includes('i2.markieren'))
        d.room.revealed = [...d.room.revealed, 'i2.markieren']
    })
  }

  timer(action: TimerAction): Promise<void> {
    return this.facilitator((d) => {
      if ((action.type === 'start' || action.type === 'add') && !(action.ms > 0 && action.ms <= 3 * 60 * 60 * 1000))
        throw new WorkshopError('invalid')
      d.room.timer = applyTimer(d.room.timer, action, this.server.now())
    })
  }

  updateSettings(settings: RoomSettings): Promise<void> {
    return this.facilitator((d) => {
      const s = normalizeSettings(settings)
      if (!hasStep(d.room.program, s, d.room.stepKey)) throw new WorkshopError('invalid')
      d.room.settings = s
      // groups beyond the new count lose members and draws
      for (const m of d.members) if (m.groupNo && m.groupNo > s.groupCount) m.groupNo = null
      d.draws = d.draws.filter((x) => x.groupNo <= s.groupCount)
    })
  }

  setGroups(assignment: Record<string, number | null>): Promise<void> {
    return this.facilitator((d) => {
      for (const [memberId, g] of Object.entries(assignment)) {
        const m = d.members.find((x) => x.id === memberId)
        if (!m || m.role !== 'participant') continue
        if (g !== null && (!Number.isInteger(g) || g < 1 || g > d.room.settings.groupCount))
          throw new WorkshopError('invalid')
        m.groupNo = g
      }
    })
  }

  setDraw(groupNo: number, archetypeId: string | null, method: DrawMethod = 'manual'): Promise<void> {
    return this.facilitator((d, me) => {
      if (groupNo < 1 || groupNo > d.room.settings.groupCount) throw new WorkshopError('invalid')
      d.draws = d.draws.filter((x) => x.groupNo !== groupNo)
      if (archetypeId === null) return
      if (!ARCHETYPE_IDS.includes(archetypeId)) throw new WorkshopError('invalid')
      if (!canAssignArchetype(groupNo, archetypeId, d.draws)) throw new WorkshopError('taken')
      d.draws.push({
        id: this.server.newId(),
        groupNo,
        archetypeId,
        method,
        drawnBy: me.userId,
        drawnAt: this.server.now(),
      })
    })
  }

  reveal(stepKey: StepKey): Promise<void> {
    return this.facilitator((d) => {
      if (!d.room.revealed.includes(stepKey)) d.room.revealed = [...d.room.revealed, stepKey]
    })
  }

  setPitchGroup(groupNo: number | null): Promise<void> {
    return this.facilitator((d) => {
      if (groupNo !== null && (groupNo < 1 || groupNo > d.room.settings.groupCount)) throw new WorkshopError('invalid')
      d.room.pitchGroup = groupNo
      d.room.timer = IDLE_TIMER
    })
  }

  select(kind: SelectionKind, refType: RefType, refId: string): Promise<string> {
    return this.facilitator((d) => {
      const dup = d.selections.find((s) => s.kind === kind && s.refType === refType && s.refId === refId)
      if (dup) return dup.id
      const id = this.server.newId()
      const position = Math.max(0, ...d.selections.filter((s) => s.kind === kind).map((s) => s.position + 1))
      d.selections.push({ id, kind, refType, refId, position })
      return id
    })
  }

  unselect(selectionId: string): Promise<void> {
    return this.facilitator((d) => {
      d.selections = d.selections.filter((s) => s.id !== selectionId)
      // like ON DELETE CASCADE
      d.ratings = d.ratings.filter((r) => r.selectionId !== selectionId)
      d.implSteps = d.implSteps.filter((s) => s.selectionId !== selectionId)
      d.notes = d.notes.filter((n) => n.selectionId !== selectionId)
    })
  }

  closeRoom(): Promise<void> {
    return this.facilitator((d) => {
      d.room.status = 'closed'
      d.room.timer = IDLE_TIMER
    })
  }

  // --- groups ------------------------------------------------------------------

  draw(groupNo: number): Promise<void> {
    return this.writable((d, me) => {
      if (!canDraw(me, groupNo)) throw new WorkshopError('not-your-group')
      if (groupNo < 1 || groupNo > d.room.settings.groupCount) throw new WorkshopError('invalid')
      if (d.draws.some((x) => x.groupNo === groupNo)) throw new WorkshopError('taken')
      const archetypeId = drawArchetype(ARCHETYPE_IDS, d.draws, this.server.random)
      if (!archetypeId) throw new WorkshopError('taken')
      d.draws.push({
        id: this.server.newId(),
        groupNo,
        archetypeId,
        method: 'random',
        drawnBy: me.userId,
        drawnAt: this.server.now(),
      })
    })
  }

  saveIdea(input: IdeaInput): Promise<string> {
    return this.writable((d, me) => {
      const now = this.server.now()
      const fields = {
        ...(input.title !== undefined && { title: checkLength(input.title, LIMITS.ideaTitle) }),
        ...(input.description !== undefined && { description: checkLength(input.description, LIMITS.ideaDescription) }),
        ...(input.target !== undefined && { target: checkLength(input.target, LIMITS.ideaTarget) }),
        ...(input.inspiredBy !== undefined && { inspiredBy: input.inspiredBy }),
      }
      if (fields.inspiredBy && !isCaseCard(fields.inspiredBy)) throw new WorkshopError('not-case')
      const existing = input.id ? d.ideas.find((i) => i.id === input.id) : undefined
      if (existing) {
        if (!canEditGroup(me, existing.groupNo)) throw new WorkshopError('not-your-group')
        Object.assign(existing, fields, { updatedAt: now })
        return existing.id
      }
      if (!canEditGroup(me, input.groupNo)) throw new WorkshopError('not-your-group')
      if (d.ideas.filter((i) => i.groupNo === input.groupNo).length >= LIMITS.ideasPerGroup)
        throw new WorkshopError('too-many-ideas')
      const id = input.id ?? this.server.newId()
      d.ideas.push({
        id,
        groupNo: input.groupNo,
        title: '',
        description: '',
        inspiredBy: null,
        target: '',
        ...fields,
        createdBy: me.userId,
        updatedAt: now,
      })
      return id
    })
  }

  deleteIdea(id: string): Promise<void> {
    return this.writable((d, me) => {
      const idea = d.ideas.find((i) => i.id === id)
      if (!idea) return
      if (!canEditGroup(me, idea.groupNo)) throw new WorkshopError('not-your-group')
      d.ideas = d.ideas.filter((i) => i.id !== id)
    })
  }

  // --- own rows ------------------------------------------------------------------

  toggleVote(cardId: string): Promise<void> {
    return this.mutate((d, me) => {
      const has = d.votes.find((v) => v.userId === me.userId && v.cardId === cardId)
      const mine = { ...d, votes: d.votes.filter((v) => v.userId === me.userId) }
      const op = checkVote(mine, me, isCaseCard(cardId), !!has)
      if (op === 'remove') d.votes = d.votes.filter((v) => v !== has)
      else d.votes.push({ id: this.server.newId(), userId: me.userId, cardId })
    })
  }

  rate(selectionId: string, criterion: Criterion, score: number | null): Promise<void> {
    return this.mutate((d, me) => {
      checkRating(d, me, score)
      if (!d.selections.some((s) => s.id === selectionId && s.kind === 'strategy_target'))
        throw new WorkshopError('not-found')
      d.ratings = d.ratings.filter(
        (r) => !(r.userId === me.userId && r.selectionId === selectionId && r.criterion === criterion),
      )
      if (score !== null) d.ratings.push({ id: this.server.newId(), userId: me.userId, selectionId, criterion, score })
    })
  }

  addNote(input: NoteInput): Promise<string> {
    return this.writable((d, me) => {
      const body = checkLength(input.body, LIMITS.note)
      if (!body) throw new WorkshopError('invalid')
      const id = this.server.newId()
      d.notes.push({
        id,
        stepKey: input.stepKey,
        topic: input.topic,
        selectionId: input.selectionId ?? null,
        body,
        authorId: me.userId,
        byFacilitator: me.role === 'facilitator',
        createdAt: this.server.now(),
      })
      return id
    })
  }

  editNote(id: string, body: string): Promise<void> {
    return this.writable((d, me) => {
      const n = d.notes.find((x) => x.id === id)
      if (!n) throw new WorkshopError('not-found')
      if (n.authorId !== me.userId) throw new WorkshopError('not-member')
      n.body = checkLength(body, LIMITS.note)
    })
  }

  deleteNote(id: string): Promise<void> {
    return this.writable((d, me) => {
      const n = d.notes.find((x) => x.id === id)
      if (!n) return
      if (n.authorId !== me.userId && me.role !== 'facilitator') throw new WorkshopError('not-member')
      d.notes = d.notes.filter((x) => x !== n)
    })
  }

  saveImplStep(input: ImplStepInput): Promise<string> {
    return this.writable((d, me) => {
      const fields = {
        ...(input.what !== undefined && { what: checkLength(input.what, LIMITS.implWhat) }),
        ...(input.who !== undefined && { who: checkLength(input.who, LIMITS.implWho) }),
        ...(input.due !== undefined && { due: input.due }),
      }
      if (fields.due && !/^\d{4}-\d{2}-\d{2}$/.test(fields.due)) throw new WorkshopError('invalid')
      const existing = input.id ? d.implSteps.find((s) => s.id === input.id) : undefined
      if (existing) {
        if (existing.createdBy !== me.userId && me.role !== 'facilitator') throw new WorkshopError('not-member')
        Object.assign(existing, fields)
        return existing.id
      }
      if (!d.selections.some((s) => s.id === input.selectionId)) throw new WorkshopError('not-found')
      const id = input.id ?? this.server.newId()
      const position = Math.max(
        0,
        ...d.implSteps.filter((s) => s.selectionId === input.selectionId).map((s) => s.position + 1),
      )
      d.implSteps.push({
        id,
        selectionId: input.selectionId,
        what: '',
        who: '',
        due: null,
        ...fields,
        position,
        createdBy: me.userId,
      })
      return id
    })
  }

  deleteImplStep(id: string): Promise<void> {
    return this.writable((d, me) => {
      const s = d.implSteps.find((x) => x.id === id)
      if (!s) return
      if (s.createdBy !== me.userId && me.role !== 'facilitator') throw new WorkshopError('not-member')
      d.implSteps = d.implSteps.filter((x) => x !== s)
    })
  }
}

/** Puts everyone without a group into the smallest one (facilitator helper). */
export const autoAssign = (snap: RoomSnapshot) => balanceGroups(snap.members, snap.room.settings.groupCount)
