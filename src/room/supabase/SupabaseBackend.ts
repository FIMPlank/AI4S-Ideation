/**
 * Live backend: Supabase with anonymous sign-ins, RPCs for room state and
 * Postgres Changes (RLS applies) for sync. Loaded lazily on room routes only.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import {
  clockOffset,
  normalizeCode,
  WorkshopError,
  type ClockSample,
  type Criterion,
  type DrawMethod,
  type Me,
  type RefType,
  type RoomSettings,
  type RoomSnapshot,
  type SelectionKind,
  type StepKey,
} from '../../workshop'
import type { TimerAction } from '../../workshop/timer'
import type {
  CreateRoomInput,
  CreatedRoom,
  IdeaInput,
  ImplStepInput,
  NoteInput,
  StoreState,
  WorkshopBackend,
  WorkshopStore,
} from '../../workshop/store/types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config'
import { TABLES, toReason, toRoom, toSnapshot, type TableName } from './map'

type Row = Record<string, unknown>

export function createSupabaseBackend(): WorkshopBackend {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ai4s.live.auth' },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  let session: Promise<string> | null = null
  /** Signs in anonymously once; the session persists, so reloads keep the identity. */
  const userId = () =>
    (session ??= (async () => {
      const { data } = await client.auth.getSession()
      if (data.session) return data.session.user.id
      const { data: d, error } = await client.auth.signInAnonymously()
      if (error || !d.user) {
        session = null
        const disabled = error && 'code' in error && error.code === 'anonymous_provider_disabled'
        throw new WorkshopError(disabled ? 'sign-in-disabled' : 'invalid', error?.message)
      }
      return d.user.id
    })())

  return {
    async createRoom(input: CreateRoomInput): Promise<CreatedRoom> {
      await userId()
      const { data, error } = await client.rpc('create_room', {
        p_title: input.title,
        p_program: input.program,
        p_settings: input.settings,
      })
      if (error) throw new WorkshopError(toReason(error), error.message)
      const row = (Array.isArray(data) ? data[0] : data) as Row
      return { roomId: String(row.room_id), code: String(row.code), facilitatorSecret: String(row.facilitator_secret) }
    },
    async openRoom(code: string): Promise<WorkshopStore> {
      const uid = await userId()
      const store = new SupabaseStore(client, uid, normalizeCode(code))
      await store.init()
      return store
    },
  }
}

class SupabaseStore implements WorkshopStore {
  private client: SupabaseClient
  private code: string
  private roomId: string | null = null
  private state: StoreState
  private listeners = new Set<() => void>()
  private channel: RealtimeChannel | null = null
  private channelKey = ''
  private offset = 0
  private wasDown = false
  private progressTimer: ReturnType<typeof setInterval> | null = null
  private reloadTimer: ReturnType<typeof setTimeout> | null = null
  private cleanup: (() => void)[] = []

  constructor(client: SupabaseClient, userId: string, code: string) {
    this.client = client
    this.code = code
    this.state = {
      snapshot: null,
      me: { userId, memberId: null, role: null, groupNo: null },
      connection: 'connecting',
      ready: false,
      lastError: null,
      progress: null,
      online: null,
    }
  }

  // --- lifecycle ---------------------------------------------------------------

  async init() {
    void this.measureClock()
    const { data } = await this.client.rpc('my_room', { p_code: this.code })
    this.roomId = (data as string | null) ?? null
    if (this.roomId) await this.load()
    this.set({ ready: true, connection: this.roomId ? this.state.connection : 'live' })
    const onVisible = () => document.visibilityState === 'visible' && this.roomId && void this.load()
    const onOnline = () => this.roomId && void this.load()
    const onOffline = () => this.set({ connection: 'offline' })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    this.cleanup.push(
      () => document.removeEventListener('visibilitychange', onVisible),
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
    )
  }

  dispose(): void {
    this.cleanup.forEach((f) => f())
    if (this.channel) void this.client.removeChannel(this.channel)
    if (this.progressTimer) clearInterval(this.progressTimer)
    this.listeners.clear()
  }

  getState = (): StoreState => this.state
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  serverNow = () => Date.now() + this.offset

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }

  private async measureClock() {
    const samples: ClockSample[] = []
    for (let i = 0; i < 3; i++) {
      const sentAt = Date.now()
      const { data, error } = await this.client.rpc('server_now')
      if (error) return
      samples.push({ sentAt, server: Date.parse(String(data)), receivedAt: Date.now() })
    }
    this.offset = clockOffset(samples)
    this.set({})
  }

  /** Full snapshot in one round trip (after start, reconnect, wake-up). */
  private async load() {
    if (!this.roomId) return
    const { data, error } = await this.client.rpc('room_snapshot', { p_room: this.roomId })
    if (error) return this.set({ connection: navigator.onLine === false ? 'offline' : 'reconnecting' })
    const snapshot = toSnapshot(data as Row)
    this.applySnapshot(snapshot)
    this.ensureChannel()
    void this.refreshProgress()
  }

  private applySnapshot(snapshot: RoomSnapshot | null) {
    const uid = this.state.me.userId
    const m = snapshot?.members.find((x) => x.userId === uid)
    const me: Me = { userId: uid, memberId: m?.id ?? null, role: m?.role ?? null, groupNo: m?.groupNo ?? null }
    this.set({ snapshot, me })
    this.syncProgressPolling()
  }

  private scheduleReload(ms = 250) {
    if (this.reloadTimer) clearTimeout(this.reloadTimer)
    this.reloadTimer = setTimeout(() => void this.load(), ms)
  }

  // --- realtime ---------------------------------------------------------------

  /** One channel per client; phones hear only their own group's ideas. Rebuilt when the group changes. */
  private ensureChannel() {
    const { me } = this.state
    if (!this.roomId || !me.memberId) return
    const key = `${me.role}:${me.groupNo ?? ''}`
    if (this.channel && this.channelKey === key) return
    if (this.channel) void this.client.removeChannel(this.channel)
    this.channelKey = key
    const room = this.roomId
    const ch = this.client.channel(`room:${room}`, { config: { presence: { key: me.userId } } })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room}` }, (p) =>
      this.onRoom(p.new as Row),
    )
    for (const table of Object.keys(TABLES) as TableName[]) {
      const filter =
        table === 'ideas' && me.role !== 'facilitator' && me.groupNo
          ? `room_group=eq.${room}:${me.groupNo}`
          : `room_id=eq.${room}`
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (p) =>
        this.onRow(table, p.eventType, p.new as Row, p.old as Row),
      )
    }
    ch.on('presence', { event: 'sync' }, () => this.set({ online: Object.keys(ch.presenceState()) }))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        if (this.wasDown) {
          this.wasDown = false
          void this.load()
        }
        this.set({ connection: 'live' })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (this.channel === ch) {
          this.wasDown = true
          this.set({ connection: navigator.onLine === false ? 'offline' : 'reconnecting' })
        }
      }
    })
    this.channel = ch
  }

  private onRoom(row: Row) {
    const snap = this.state.snapshot
    if (!snap || !row?.id) return
    const room = toRoom(row)
    const prev = snap.room
    this.applySnapshot({ ...snap, room })
    // rows hidden by RLS before a reveal don't arrive as events: fetch them now
    if (room.revealed.length !== prev.revealed.length) this.scheduleReload(0)
    // other devices see ideas of all groups at the pitch and the end
    if (
      room.stepKey !== prev.stepKey &&
      (room.stepKey === 'i1.pitch' || room.stepKey === 'ende' || room.status === 'closed')
    )
      this.scheduleReload(0)
  }

  private onRow(table: TableName, type: string, row: Row, old: Row) {
    const snap = this.state.snapshot
    if (!snap) return
    const { key, map } = TABLES[table]
    const list = snap[key] as { id: string }[]
    let next: { id: string }[]
    if (type === 'DELETE') next = list.filter((x) => x.id !== old?.id)
    else {
      const item = map(row) as { id: string }
      const i = list.findIndex((x) => x.id === item.id)
      next = i < 0 ? [...list, item] : list.map((x, k) => (k === i ? item : x))
    }
    this.applySnapshot({ ...snap, [key]: next })
    if (table === 'room_members' || table === 'selections') void this.refreshProgress()
    if (table === 'room_members') this.ensureChannel()
  }

  // --- hidden progress (facilitator) -------------------------------------------

  private syncProgressPolling() {
    const snap = this.state.snapshot
    const need =
      this.state.me.role === 'facilitator' &&
      snap &&
      (snap.room.stepKey === 'i2.markieren' || snap.room.stepKey === 'st.bewerten')
    if (need && !this.progressTimer) this.progressTimer = setInterval(() => void this.refreshProgress(), 3000)
    if (!need && this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }

  private async refreshProgress() {
    if (!this.roomId || this.state.me.role !== 'facilitator') return
    const { data } = await this.client.rpc('step_progress', { p_room: this.roomId })
    const row = (Array.isArray(data) ? data[0] : data) as Row | undefined
    if (row)
      this.set({
        progress: { participants: Number(row.participants), voted: Number(row.voted), rated: Number(row.rated) },
      })
  }

  // --- helpers --------------------------------------------------------------------

  private fail(error: { message?: string; code?: string }): never {
    const reason = toReason(error)
    this.set({ lastError: reason })
    throw new WorkshopError(reason, error.message)
  }

  private ok() {
    if (this.state.lastError) this.set({ lastError: null })
    // without a live channel, echoes don't arrive: refetch
    if (this.state.connection !== 'live') this.scheduleReload()
  }

  private get room(): string {
    if (!this.roomId) throw new WorkshopError('not-member')
    return this.roomId
  }

  private async rpc(fn: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(fn, args)
    if (error) this.fail(error)
    this.ok()
    return data
  }

  /** Applies a local change now, and rolls it back if the server refuses. */
  private async optimistic<T>(
    patch: (s: RoomSnapshot) => RoomSnapshot,
    run: () => PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>,
  ): Promise<T> {
    const before = this.state.snapshot
    if (before) this.applySnapshot(patch(before))
    const { data, error } = await run()
    if (error) {
      // roll back only our own change: refetch the truth
      if (before) this.applySnapshot(before)
      this.scheduleReload()
      this.fail(error)
    }
    this.ok()
    return data
  }

  // --- membership -----------------------------------------------------------------

  async join(displayName: string) {
    const data = await this.rpc('join_room', { p_code: this.code, p_display_name: displayName })
    this.roomId = String(data)
    await this.load()
  }

  async rename(displayName: string) {
    await this.rpc('rename_me', { p_room: this.room, p_display_name: displayName })
  }

  async claimFacilitator(secret: string) {
    const data = await this.rpc('claim_facilitator', { p_code: this.code, p_secret: secret })
    this.roomId = String(data)
    this.channelKey = ''
    await this.load()
  }

  // --- facilitator -------------------------------------------------------------------

  async setStep(expected: StepKey, next: StepKey) {
    await this.rpc('set_step', { p_room: this.room, p_expected: expected, p_next: next })
  }
  async timer(action: TimerAction) {
    await this.rpc('set_timer', { p_room: this.room, p_action: action.type, p_ms: 'ms' in action ? action.ms : null })
  }
  async updateSettings(settings: RoomSettings) {
    await this.rpc('update_settings', { p_room: this.room, p_settings: settings })
  }
  async setGroups(assignment: Record<string, number | null>) {
    await this.rpc('set_groups', { p_room: this.room, p_assignment: assignment })
  }
  async setDraw(groupNo: number, archetypeId: string | null, method: DrawMethod = 'manual') {
    await this.rpc('set_draw', { p_room: this.room, p_group: groupNo, p_archetype: archetypeId, p_method: method })
  }
  async reveal(stepKey: StepKey) {
    await this.rpc('reveal', { p_room: this.room, p_step: stepKey })
  }
  async setPitchGroup(groupNo: number | null) {
    await this.rpc('set_pitch_group', { p_room: this.room, p_group: groupNo })
  }
  async closeRoom() {
    await this.rpc('close_room', { p_room: this.room })
  }

  async select(kind: SelectionKind, refType: RefType, refId: string): Promise<string> {
    const snap = this.state.snapshot
    const dup = snap?.selections.find((s) => s.kind === kind && s.refType === refType && s.refId === refId)
    if (dup) return dup.id
    const id = crypto.randomUUID()
    const position = Math.max(0, ...(snap?.selections.filter((s) => s.kind === kind).map((s) => s.position + 1) ?? []))
    await this.optimistic(
      (s) => ({ ...s, selections: [...s.selections, { id, kind, refType, refId, position }] }),
      () =>
        this.client
          .from('selections')
          .insert({ id, room_id: this.room, kind, ref_type: refType, ref_id: refId, position }),
    )
    return id
  }

  async unselect(selectionId: string) {
    await this.optimistic(
      (s) => ({
        ...s,
        selections: s.selections.filter((x) => x.id !== selectionId),
        ratings: s.ratings.filter((x) => x.selectionId !== selectionId),
        implSteps: s.implSteps.filter((x) => x.selectionId !== selectionId),
        notes: s.notes.filter((x) => x.selectionId !== selectionId),
      }),
      () => this.client.from('selections').delete().eq('id', selectionId),
    )
  }

  // --- groups ------------------------------------------------------------------------

  async draw(groupNo: number) {
    await this.rpc('draw_archetype', { p_room: this.room, p_group: groupNo })
  }

  async saveIdea(input: IdeaInput): Promise<string> {
    const snap = this.state.snapshot
    const existing = input.id ? snap?.ideas.find((i) => i.id === input.id) : undefined
    const fields: Row = {}
    if (input.title !== undefined) fields.title = input.title.trim()
    if (input.description !== undefined) fields.description = input.description.trim()
    if (input.target !== undefined) fields.target = input.target.trim()
    if (input.inspiredBy !== undefined) fields.inspired_by = input.inspiredBy
    const local = {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() }),
      ...(input.target !== undefined && { target: input.target.trim() }),
      ...(input.inspiredBy !== undefined && { inspiredBy: input.inspiredBy }),
    }
    if (existing) {
      await this.optimistic(
        (s) => ({
          ...s,
          ideas: s.ideas.map((i) => (i.id === existing.id ? { ...i, ...local, updatedAt: Date.now() } : i)),
        }),
        () => this.client.from('ideas').update(fields).eq('id', existing.id),
      )
      return existing.id
    }
    const id = input.id ?? crypto.randomUUID()
    const uid = this.state.me.userId
    await this.optimistic(
      (s) => ({
        ...s,
        ideas: [
          ...s.ideas,
          {
            id,
            groupNo: input.groupNo,
            title: '',
            description: '',
            inspiredBy: null,
            target: '',
            ...local,
            createdBy: uid,
            updatedAt: Date.now(),
          },
        ],
      }),
      () => this.client.from('ideas').insert({ id, room_id: this.room, group_no: input.groupNo, ...fields }),
    )
    return id
  }

  async deleteIdea(id: string) {
    await this.optimistic(
      (s) => ({ ...s, ideas: s.ideas.filter((i) => i.id !== id) }),
      () => this.client.from('ideas').delete().eq('id', id),
    )
  }

  // --- own rows --------------------------------------------------------------------------

  async toggleVote(cardId: string) {
    const uid = this.state.me.userId
    const has = this.state.snapshot?.votes.find((v) => v.userId === uid && v.cardId === cardId)
    if (has) {
      await this.optimistic(
        (s) => ({ ...s, votes: s.votes.filter((v) => v.id !== has.id) }),
        () => this.client.from('votes').delete().eq('id', has.id),
      )
      return
    }
    const id = crypto.randomUUID()
    await this.optimistic(
      (s) => ({ ...s, votes: [...s.votes, { id, userId: uid, cardId }] }),
      () => this.client.from('votes').insert({ id, room_id: this.room, card_id: cardId }),
    )
  }

  async rate(selectionId: string, criterion: Criterion, score: number | null) {
    const uid = this.state.me.userId
    const has = this.state.snapshot?.ratings.find(
      (r) => r.userId === uid && r.selectionId === selectionId && r.criterion === criterion,
    )
    if (score === null) {
      if (!has) return
      await this.optimistic(
        (s) => ({ ...s, ratings: s.ratings.filter((r) => r.id !== has.id) }),
        () => this.client.from('ratings').delete().eq('id', has.id),
      )
    } else if (has) {
      await this.optimistic(
        (s) => ({ ...s, ratings: s.ratings.map((r) => (r.id === has.id ? { ...r, score } : r)) }),
        () => this.client.from('ratings').update({ score }).eq('id', has.id),
      )
    } else {
      const id = crypto.randomUUID()
      await this.optimistic(
        (s) => ({ ...s, ratings: [...s.ratings, { id, userId: uid, selectionId, criterion, score }] }),
        () =>
          this.client.from('ratings').insert({ id, room_id: this.room, selection_id: selectionId, criterion, score }),
      )
    }
  }

  async addNote(input: NoteInput): Promise<string> {
    const id = crypto.randomUUID()
    const uid = this.state.me.userId
    const body = input.body.trim()
    await this.optimistic(
      (s) => ({
        ...s,
        notes: [
          ...s.notes,
          {
            id,
            stepKey: input.stepKey,
            topic: input.topic,
            selectionId: input.selectionId ?? null,
            body,
            authorId: uid,
            byFacilitator: this.state.me.role === 'facilitator',
            createdAt: Date.now(),
          },
        ],
      }),
      () =>
        this.client.from('notes').insert({
          id,
          room_id: this.room,
          step_key: input.stepKey,
          topic: input.topic,
          selection_id: input.selectionId ?? null,
          body,
        }),
    )
    return id
  }

  async editNote(id: string, body: string) {
    await this.optimistic(
      (s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, body: body.trim() } : n)) }),
      () => this.client.from('notes').update({ body: body.trim() }).eq('id', id),
    )
  }

  async deleteNote(id: string) {
    await this.optimistic(
      (s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }),
      () => this.client.from('notes').delete().eq('id', id),
    )
  }

  async saveImplStep(input: ImplStepInput): Promise<string> {
    const snap = this.state.snapshot
    const existing = input.id ? snap?.implSteps.find((x) => x.id === input.id) : undefined
    const fields: Row = {}
    if (input.what !== undefined) fields.what = input.what.trim()
    if (input.who !== undefined) fields.who = input.who.trim()
    if (input.due !== undefined) fields.due = input.due
    if (existing) {
      await this.optimistic(
        (s) => ({
          ...s,
          implSteps: s.implSteps.map((x) => (x.id === existing.id ? { ...x, ...(fields as object) } : x)),
        }),
        () => this.client.from('impl_steps').update(fields).eq('id', existing.id),
      )
      return existing.id
    }
    const id = input.id ?? crypto.randomUUID()
    const position = Math.max(
      0,
      ...(snap?.implSteps.filter((x) => x.selectionId === input.selectionId).map((x) => x.position + 1) ?? []),
    )
    const uid = this.state.me.userId
    await this.optimistic(
      (s) => ({
        ...s,
        implSteps: [
          ...s.implSteps,
          {
            id,
            selectionId: input.selectionId,
            what: input.what?.trim() ?? '',
            who: input.who?.trim() ?? '',
            due: input.due ?? null,
            position,
            createdBy: uid,
          },
        ],
      }),
      () =>
        this.client
          .from('impl_steps')
          .insert({ id, room_id: this.room, selection_id: input.selectionId, position, ...fields }),
    )
    return id
  }

  async deleteImplStep(id: string) {
    await this.optimistic(
      (s) => ({ ...s, implSteps: s.implSteps.filter((x) => x.id !== id) }),
      () => this.client.from('impl_steps').delete().eq('id', id),
    )
  }
}
