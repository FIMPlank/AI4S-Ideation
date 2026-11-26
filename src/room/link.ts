import { createContext, useContext } from 'react'
import { roomHref, type RoomView } from '../lib/router'

/**
 * The room code as it appears in the address bar. Usually the room's own
 * code; in the Demo-Raum it is "demo", so links must stay on the demo route.
 */
export const RouteCode = createContext<string | null>(null)

/** roomHref that keeps links on the current route (demo stays demo). */
export function useRoomHref() {
  const route = useContext(RouteCode)
  return (code: string, view?: RoomView) => roomHref(route ?? code, view)
}
