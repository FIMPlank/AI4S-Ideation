import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RoomView } from '../lib/router'
import type { StoreState, WorkshopStore } from '../workshop/store/types'
import { openRoomStore } from './backend'

export type StoreLoad =
  { status: 'loading' } | { status: 'unavailable' } | { status: 'error' } | { status: 'ready'; store: WorkshopStore }

export function useRoomStore(code: string, view: RoomView, version = 0): StoreLoad {
  const key = `${code}|${view}|${version}`
  const [load, setLoad] = useState<{ key: string; value: StoreLoad } | null>(null)
  useEffect(() => {
    let alive = true
    openRoomStore(code, view).then(
      (store) => alive && setLoad({ key, value: store ? { status: 'ready', store } : { status: 'unavailable' } }),
      () => alive && setLoad({ key, value: { status: 'error' } }),
    )
    return () => {
      alive = false
    }
  }, [code, view, key])
  return load?.key === key ? load.value : LOADING
}

const LOADING: StoreLoad = { status: 'loading' }

export function useStoreState(store: WorkshopStore): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState)
}

/** Server time, re-rendered every `ms` while mounted (for countdowns). */
export function useServerNow(store: WorkshopStore, ms = 250): number {
  const [now, setNow] = useState(() => store.serverNow())
  useEffect(() => {
    const id = setInterval(() => setNow(store.serverNow()), ms)
    return () => clearInterval(id)
  }, [store, ms])
  return now
}

/** Runs an action, swallowing the error (the store reports it as lastError). */
export const fire = (p: Promise<unknown>) => {
  p.catch(() => undefined)
}
