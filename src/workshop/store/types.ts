/**
 * The interface every room UI talks to. Two implementations: MemoryStore (tests,
 * Demo-Raum) and SupabaseStore (live). UI code never imports a backend directly.
 */
import type { DenyReason } from '../rules'
import type { TimerAction } from '../timer'
import type {
  Criterion,
  DrawMethod,
  Idea,
  ImplStep,
  Me,
  ProgramId,
  RefType,
  RoomSettings,
  RoomSnapshot,
  SelectionKind,
  StepKey,
} from '../types'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'

export interface StoreState {
  /** null until this browser is a member (and the first snapshot has loaded). */
  snapshot: RoomSnapshot | null
  me: Me
  connection: ConnectionState
  /** true once we know whether we are a member (so the UI can show the join form). */
  ready: boolean
  /** Last failed action, for a toast; cleared by the next successful one. */
  lastError: DenyReason | null
  /** Counts the facilitator sees before reveal (never the distribution); null for participants. */
  progress: HiddenProgress | null
  /** User ids currently online (presence); null if unknown. */
  online: string[] | null
}

export interface HiddenProgress {
  participants: number
  /** placed all their dots */
  voted: number
  /** rated every criterion of every strategy item */
  rated: number
}

export interface CreateRoomInput {
  title: string
  program: ProgramId
  settings: RoomSettings
}

export interface CreatedRoom {
  roomId: string
  code: string
  /** Shown once as the Moderationslink; only its hash is stored. */
  facilitatorSecret: string
}

export interface IdeaInput {
  id?: string
  groupNo: number
  title?: string
  description?: string
  inspiredBy?: string | null
  target?: string
}

export interface NoteInput {
  stepKey: StepKey
  topic: string
  selectionId?: string | null
  body: string
}

export interface ImplStepInput {
  id?: string
  selectionId: string
  what?: string
  who?: string
  due?: string | null
}

export interface WorkshopActions {
  join(displayName: string): Promise<void>
  rename(displayName: string): Promise<void>
  claimFacilitator(secret: string): Promise<void>

  // facilitator only
  setStep(expected: StepKey, next: StepKey): Promise<void>
  timer(action: TimerAction): Promise<void>
  updateSettings(settings: RoomSettings): Promise<void>
  setGroups(assignment: Record<string, number | null>): Promise<void>
  setDraw(groupNo: number, archetypeId: string | null, method?: DrawMethod): Promise<void>
  reveal(stepKey: StepKey): Promise<void>
  setPitchGroup(groupNo: number | null): Promise<void>
  select(kind: SelectionKind, refType: RefType, refId: string): Promise<string>
  unselect(selectionId: string): Promise<void>
  closeRoom(): Promise<void>

  // group member or facilitator
  draw(groupNo: number): Promise<void>
  saveIdea(input: IdeaInput): Promise<string>
  deleteIdea(id: string): Promise<void>

  // everyone, own rows
  toggleVote(cardId: string): Promise<void>
  rate(selectionId: string, criterion: Criterion, score: number | null): Promise<void>
  addNote(input: NoteInput): Promise<string>
  editNote(id: string, body: string): Promise<void>
  deleteNote(id: string): Promise<void>
  saveImplStep(input: ImplStepInput): Promise<string>
  deleteImplStep(id: string): Promise<void>
}

export interface WorkshopStore extends WorkshopActions {
  getState(): StoreState
  subscribe(listener: () => void): () => void
  /** Current server time (Date.now() + measured clock offset). */
  serverNow(): number
  dispose(): void
}

/** Creates rooms and opens a store for one room code. */
export interface WorkshopBackend {
  createRoom(input: CreateRoomInput): Promise<CreatedRoom>
  openRoom(code: string): Promise<WorkshopStore>
}

export type { Idea, ImplStep }
