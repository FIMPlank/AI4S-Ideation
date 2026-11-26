/**
 * Picks the store for a room: the Demo-Raum runs on the in-memory backend, real
 * codes on Supabase (loaded lazily, so landing and deck never download it).
 */
import { DEMO_CODE, type RoomView } from '../lib/router'
import type { WorkshopBackend, WorkshopStore } from '../workshop/store/types'
import { backendConfigured } from './config'
import { demoRoom } from './demo'

let live: Promise<WorkshopBackend | null> | null = null

/** The live backend, or null when no Supabase config was built in. */
export function liveBackend(): Promise<WorkshopBackend | null> {
  if (!backendConfigured) return Promise.resolve(null)
  return (live ??= import('./supabase/SupabaseBackend').then((m) => m.createSupabaseBackend()))
}

const stores = new Map<string, Promise<WorkshopStore>>()

/** One store per room code (shared by all views in this browser). */
export async function openRoomStore(code: string, view: RoomView): Promise<WorkshopStore | null> {
  if (code === DEMO_CODE) return demoRoom().store(view)
  const backend = await liveBackend()
  if (!backend) return null
  let s = stores.get(code)
  if (!s) {
    s = backend.openRoom(code)
    stores.set(code, s)
    s.catch(() => stores.delete(code))
  }
  return s
}
