import { useEffect, useState, type ReactNode } from 'react'
import { t } from '../../i18n/de'
import { formatClock, formatCode, isExpired, isPaused, remainingMs, type Room, type TimerState } from '../../workshop'
import type { ConnectionState, WorkshopStore } from '../../workshop/store/types'
import { fire, useServerNow } from '../hooks'
import { errorText, groupSurface } from '../labels'
import type { RoomSnapshot } from '../../workshop'

const r = t.room

export function ConnectionBadge({ connection }: { connection: ConnectionState }) {
  if (connection === 'live') return <span className="conn conn--live visually-hidden">{r.conn.live}</span>
  return (
    <span className={`conn conn--${connection}`} role="status">
      <span className="conn__dot" aria-hidden="true" />
      {r.conn[connection]}
    </span>
  )
}

/** Shows the store's last error for a few seconds. */
export function ErrorNote({ error }: { error: string | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const shown = error && error !== dismissed ? error : null
  useEffect(() => {
    const id = setTimeout(() => setDismissed(error), error ? 5000 : 0)
    return () => clearTimeout(id)
  }, [error])
  return (
    <div className="room-toast" role="status" aria-live="polite">
      {shown && <p>{errorText(shown)}</p>}
    </div>
  )
}

export function RoomCode({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`room-code room-code--${size}`} aria-label={`${r.projector.code} ${code.split('').join(' ')}`}>
      {formatCode(code)}
    </span>
  )
}

export function GroupChip({
  snap,
  groupNo,
  children,
}: {
  snap: Pick<RoomSnapshot, 'draws'>
  groupNo: number
  children?: ReactNode
}) {
  const s = groupSurface(snap, groupNo)
  return (
    <span className="group-chip" style={{ background: s.bg, color: s.fg }}>
      {r.group(groupNo)}
      {children}
    </span>
  )
}

/** Countdown from the server end timestamp (every device in sync). */
export function TimerDisplay({
  store,
  timer,
  size = 'md',
}: {
  store: WorkshopStore
  timer: TimerState
  size?: 'md' | 'lg' | 'xl'
}) {
  const now = useServerNow(store)
  const ms = remainingMs(timer, now)
  if (ms === null) return null
  const over = isExpired(timer, now)
  return (
    <span
      className={`timer timer--${size}${over ? ' timer--over' : ''}${isPaused(timer) ? ' timer--paused' : ''}`}
      role="timer"
      aria-label={r.timer.label}
    >
      <span aria-hidden="true">{over ? r.timer.over : formatClock(ms)}</span>
      {/* screen readers get the minute, not every second */}
      <span className="visually-hidden">
        {over ? r.timer.over : r.timer.remaining(formatClock(Math.ceil(ms / 60000) * 60000))}
      </span>
    </span>
  )
}

export function TimerControls({ store, room, presets }: { store: WorkshopStore; room: Room; presets?: number[] }) {
  const tm = room.timer
  const list = presets ?? room.settings.timerPresetsMin
  return (
    <div className="timer-controls" role="group" aria-label={r.timer.label}>
      {list.map((m) => (
        <button
          key={m}
          type="button"
          className="btn btn--small"
          onClick={() => fire(store.timer({ type: 'start', ms: m * 60000 }))}
        >
          {r.timer.start(m)}
        </button>
      ))}
      {tm.endsAt !== null && (
        <button type="button" className="btn btn--small" onClick={() => fire(store.timer({ type: 'pause' }))}>
          {r.timer.pause}
        </button>
      )}
      {isPaused(tm) && (
        <button type="button" className="btn btn--small" onClick={() => fire(store.timer({ type: 'resume' }))}>
          {r.timer.resume}
        </button>
      )}
      {(tm.endsAt !== null || tm.pausedMs !== null) && (
        <>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => fire(store.timer({ type: 'add', ms: 60000 }))}
          >
            {r.timer.plus}
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => fire(store.timer({ type: 'clear' }))}
          >
            {r.timer.clear}
          </button>
        </>
      )}
    </div>
  )
}

/** QR code rendered locally (the qrcode package is loaded only here). */
export function QrCode({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    import('qrcode')
      .then((q) =>
        q.toString(text, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#16202a', light: '#ffffff' },
        }),
      )
      .then((s) => alive && setSvg(s))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [text])
  return (
    <span
      className="qr"
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      // generated locally from our own URL, not user HTML
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--small"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true)
            setTimeout(() => setDone(false), 2000)
          },
          () => undefined,
        )
      }}
    >
      {done ? t.room.create.copied : label}
    </button>
  )
}

export function Progress({ done, total, verb }: { done: number; total: number; verb: string }) {
  return (
    <div className="progress">
      <div className="progress__bar" aria-hidden="true">
        <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
      </div>
      <p>{r.progress(done, total, verb)}</p>
    </div>
  )
}
