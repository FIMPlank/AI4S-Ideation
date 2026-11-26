/** Entry of everything under #/raum (lazy chunk: supabase-js and qrcode load only here). */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n/de'
import { RouteCode } from './link'
import { DEMO_CODE, navigate, roomHref, type Route, type RoomView } from '../lib/router'
import { LIMITS } from '../workshop'
import type { WorkshopStore } from '../workshop/store/types'
import { CreateRoom } from './CreateRoom'
import { restartDemo } from './demo'
import { useRoomStore, useStoreState } from './hooks'
import { errorText } from './labels'
import { RoomHome } from './RoomHome'
import { FacilitatorConsole } from './views/Facilitator'
import { ParticipantView } from './views/Participant'
import { ProjectorView } from './views/Projector'
import { SummaryView } from './views/Summary'
import './room.css'

const r = t.room

export default function RoomApp({ route, params }: { route: Route; params: URLSearchParams }) {
  if (route.name === 'roomHome') return <RoomHome />
  if (route.name === 'roomNew') return <CreateRoom />
  if (route.name !== 'room') return null
  return <RoomShell code={route.code} view={route.view} secret={params.get('schluessel')} />
}

function RoomShell({ code, view, secret }: { code: string; view: RoomView; secret: string | null }) {
  const [version, setVersion] = useState(0)
  const load = useRoomStore(code, view, version)
  const demo = code === DEMO_CODE
  return (
    <div className={`room room--${view}${demo ? ' room--demo' : ''}`}>
      {demo && <DemoBar view={view} onRestart={() => (restartDemo(), setVersion((v) => v + 1))} />}
      {load.status === 'loading' && <Loading />}
      {load.status === 'unavailable' && <Soon />}
      {load.status === 'error' && <Message title={r.errors.generic} />}
      {load.status === 'ready' && (
        <RouteCode.Provider value={code}>
          <RoomGate store={load.store} view={view} code={code} secret={secret} />
        </RouteCode.Provider>
      )}
    </div>
  )
}

function RoomGate({
  store,
  view,
  code,
  secret,
}: {
  store: WorkshopStore
  view: RoomView
  code: string
  secret: string | null
}) {
  const state = useStoreState(store)
  const [claim, setClaim] = useState<'idle' | 'busy' | 'failed'>(secret ? 'busy' : 'idle')
  const claimed = useRef(false)

  // Moderationslink: claim once, then drop the secret from the address bar
  useEffect(() => {
    if (!secret || !state.ready || claimed.current) return
    claimed.current = true
    const clean = () => history.replaceState(null, '', roomHref(code, 'moderation'))
    if (state.me.role === 'facilitator') return clean()
    store.claimFacilitator(secret).then(
      () => (setClaim('idle'), clean()),
      () => (setClaim('failed'), clean()),
    )
  }, [secret, state.ready, state.me.role, store, code])

  if (!state.ready || (claim === 'busy' && state.me.role !== 'facilitator')) return <Loading />
  const isMember = state.me.memberId !== null
  if ((view === 'moderation' || view === 'leinwand') && state.me.role !== 'facilitator')
    return <NoAccess code={code} failed={claim === 'failed'} />
  if (!isMember) return <JoinForm store={store} />
  if (!state.snapshot) return <Loading />
  switch (view) {
    case 'moderation':
      return <FacilitatorConsole store={store} state={state} />
    case 'leinwand':
      return <ProjectorView store={store} state={state} />
    case 'ergebnis':
      return <SummaryView state={state} />
    default:
      return <ParticipantView store={store} state={state} />
  }
}

function JoinForm({ store }: { store: WorkshopStore }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const j = r.join
  return (
    <div className="join">
      <h1>{j.title}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          setBusy(true)
          store.join(name).then(
            () => setBusy(false),
            (err: { reason?: string }) => {
              setBusy(false)
              setError(
                err?.reason === 'not-found'
                  ? j.notFound
                  : err?.reason === 'closed'
                    ? j.closed
                    : err?.reason === 'room-full'
                      ? j.full
                      : errorText(err?.reason ?? 'invalid'),
              )
            },
          )
        }}
      >
        <label htmlFor={id}>{j.name}</label>
        <input
          id={id}
          value={name}
          maxLength={LIMITS.displayName}
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          onChange={(e) => setName(e.target.value)}
        />
        <p id={`${id}-hint`} className="muted">
          {j.nameHint}
        </p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy || !name.trim()}>
          {j.submit}
        </button>
      </form>
      <p className="muted join__privacy">
        <a href="#/datenschutz">{j.privacy}</a>
      </p>
    </div>
  )
}

function NoAccess({ code, failed }: { code: string; failed: boolean }) {
  return (
    <Message title={r.noAccess.title}>
      <p>{failed ? r.noAccess.claimFailed : r.noAccess.text}</p>
      <a className="btn btn--primary" href={roomHref(code)}>
        {r.noAccess.asParticipant}
      </a>
    </Message>
  )
}

function Soon() {
  return (
    <Message title={r.soon}>
      <p>{r.soonText}</p>
      <a className="btn btn--primary" href={roomHref(DEMO_CODE, 'moderation')}>
        {r.home.demoCta}
      </a>
    </Message>
  )
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="room-message">
      <h1>{title}</h1>
      {children}
      <p>
        <a href="#/raum">← {r.title}</a>
      </p>
    </div>
  )
}

function Loading() {
  return (
    <div className="room-loading" role="status">
      <span className="pulse" aria-hidden="true" />
      <span className="visually-hidden">{r.conn.connecting}</span>
    </div>
  )
}

function DemoBar({ view, onRestart }: { view: RoomView; onRestart: () => void }) {
  const d = r.demo
  const views: RoomView[] = ['moderation', 'leinwand', 'teilnehmer', 'ergebnis']
  const label = (v: RoomView) => (v === 'ergebnis' ? r.summary.title : d[v])
  return (
    <div className="demo-bar" role="region" aria-label={d.banner}>
      <a href="#/raum" className="demo-bar__back">
        ← {r.title}
      </a>
      <span className="demo-bar__label">{d.banner}</span>
      <nav aria-label={d.views} className="demo-bar__views">
        {views.map((v) => (
          <a
            key={v}
            href={roomHref(DEMO_CODE, v)}
            aria-current={v === view ? 'page' : undefined}
            onClick={(e) => (e.preventDefault(), navigate(roomHref(DEMO_CODE, v), { replace: true }))}
          >
            {label(v)}
          </a>
        ))}
      </nav>
      <button type="button" className="btn btn--small btn--ghost" onClick={onRestart}>
        {d.restart}
      </button>
    </div>
  )
}
