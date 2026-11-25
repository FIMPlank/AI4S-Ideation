import type { PointerEvent } from 'react'

/**
 * Replays the CSS animations inside the hovered (or tapped) element, unless
 * they are still running. With prefers-reduced-motion there are no
 * animations, so this does nothing.
 */
export function replayShuffle(e: PointerEvent<HTMLElement>) {
  if (typeof e.currentTarget.getAnimations !== 'function') return
  const anims = e.currentTarget.getAnimations({ subtree: true })
  if (anims.some((a) => a.playState === 'running')) return
  for (const a of anims) {
    a.cancel()
    a.play()
  }
}
