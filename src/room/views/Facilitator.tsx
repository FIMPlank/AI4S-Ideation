import { useEffect, useState } from 'react'
import { archetypes, getArchetype, getCard } from '../../data/deck'
import { t } from '../../i18n/de'
import { useRoomHref } from '../link'
import { absoluteUrl } from '../../lib/router'
import { archetypeSurface } from '../../lib/color'
import { CardImage } from '../../components/CardImage'
import {
  assignUngrouped,
  balanceGroups,
  DISCUSSION_TOPICS,
  nextStep,
  prevStep,
  ratingsVisible,
  shuffleGroups,
  stepDef,
  suggestArchetype,
  votesVisible,
  type Me,
  type RoomSnapshot,
  type StepKey,
} from '../../workshop'
import type { StoreState, WorkshopStore } from '../../workshop/store/types'
import { ARCHETYPE_IDS } from '../../workshop/deckRefs'
import { GroupBoard, IdeaWall, Ideas } from '../components/blocks'
import {
  ConnectionBadge,
  CopyButton,
  ErrorNote,
  Progress,
  QrCode,
  RoomCode,
  TimerControls,
  TimerDisplay,
} from '../components/basics'
import { CaseGrid, CardSheet } from '../components/cards'
import { ImplStepsEditor, NotesPanel } from '../components/inputs'
import { Heatmap, Matrix, Ranking, RatingTable } from '../components/results'
import { StepRail } from '../components/StepRail'
import { groupsOf, useCandidates, usePrioritised, useTally } from '../derive'
import { fire } from '../hooks'
import {
  archetypeLabel,
  archetypeShort,
  cardLabel,
  relevantArchetypes,
  selectionLabel,
  stepHelp,
  stepLabel,
  strategyTargets,
} from '../labels'

const r = t.room
const c = r.console

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))

export function FacilitatorConsole({ store, state }: { store: WorkshopStore; state: StoreState }) {
  const roomHref = useRoomHref()
  const snap = state.snapshot!
  const { room } = snap
  const next = nextStep(room.program, room.settings, room.stepKey)
  const prev = prevStep(room.program, room.settings, room.stepKey)
  const closed = room.status === 'closed'
  const go = (to: StepKey | null) => {
    if (!to || closed) return
    // Leaving "Bewerten" forward reveals the ratings, so the matrix is never lost
    const revealFirst = room.stepKey === 'st.bewerten' && to === next && !ratingsVisible(room)
    fire((revealFirst ? store.reveal('st.bewerten') : Promise.resolve()).then(() => store.setStep(room.stepKey, to)))
  }

  // Groups: everyone gets one when "Gruppen bilden" starts, latecomers later in Inspirations-Modus 1
  const ungrouped = snap.members
    .filter((m) => m.role === 'participant' && m.groupNo === null)
    .map((m) => m.id)
    .join(',')
  const inGroupPhase = !closed && room.stepKey.startsWith('i1.')
  useEffect(() => {
    if (!inGroupPhase || !ungrouped) return
    const assignment = assignUngrouped(snap.members, room.settings.groupCount)
    if (Object.keys(assignment).length) fire(store.setGroups(assignment))
    // only when the set of ungrouped people or the phase changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ungrouped, inGroupPhase])

  // keyboard: → next step, Space starts/pauses the timer
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault()
        go(next)
      } else if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault()
        go(prev)
      } else if (e.key === ' ') {
        e.preventDefault()
        const tm = room.timer
        if (tm.endsAt !== null) fire(store.timer({ type: 'pause' }))
        else if (tm.pausedMs !== null) fire(store.timer({ type: 'resume' }))
        else fire(store.timer({ type: 'start', ms: room.settings.timerPresetsMin[0] * 60000 }))
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const def = stepDef(room.stepKey)
  const participants = snap.members.filter((m) => m.role === 'participant')
  return (
    <div className="console">
      <header className="console__head">
        <div>
          <p className="eyebrow">
            {c.title}
            {room.title && ` · ${room.title}`}
          </p>
          <RoomCode code={room.code} />
        </div>
        <div className="console__head-actions">
          <ConnectionBadge connection={state.connection} />
          <a
            className="btn btn--small"
            href={roomHref(room.code, 'leinwand')}
            target="_blank"
            rel="noopener"
            title={c.projectorHint}
          >
            {c.projector}
          </a>
          <a className="btn btn--small btn--ghost" href={roomHref(room.code, 'ergebnis')}>
            {c.summary}
          </a>
        </div>
      </header>
      <div className="console__grid">
        <aside className="console__rail">
          <StepRail room={room} onPick={closed ? undefined : (k) => k !== room.stepKey && go(k)} />
          <p className="muted console__keys">{c.keyboard}</p>
        </aside>
        <section className="console__main" aria-labelledby="step-title">
          <div className="console__step-head">
            <div>
              {def && <p className="eyebrow">{r.modes[def.mode]}</p>}
              <h1 id="step-title">{stepLabel(room.stepKey)}</h1>
              <p className="lead">{stepHelp(room.stepKey, room.settings.dotsPerPerson)}</p>
              {def?.optional && <p className="tag">{`${r.optional} · ${r.fromLeitfaden}`}</p>}
            </div>
            <TimerDisplay store={store} timer={room.timer} size="lg" />
          </div>
          {!closed && <TimerControls store={store} room={room} presets={presetsFor(snap)} />}
          <div className="console__body">
            <ConsoleStep store={store} state={state} snap={snap} me={state.me} />
          </div>
          <div className="console__nav">
            <button type="button" className="btn" disabled={!prev || closed} onClick={() => go(prev)}>
              ← {c.back}
            </button>
            {room.stepKey === 'ende' ? (
              !closed ? (
                <CloseRoom onClose={() => fire(store.closeRoom())} />
              ) : (
                <span className="tag">{c.closed}</span>
              )
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--lg"
                disabled={!next || closed}
                onClick={() => go(next)}
              >
                {room.stepKey === 'lobby' ? c.start : `${c.next}: ${next ? stepLabel(next) : ''}`} →
              </button>
            )}
          </div>
        </section>
        <aside className="console__people">
          <h2>
            {c.people} <span className="muted">({participants.length})</span>
          </h2>
          <GroupBoard snap={snap} online={state.online} />
        </aside>
      </div>
      <ErrorNote error={state.lastError} />
    </div>
  )
}

/** The klärungszeit and pitch steps get their configured minutes as the first preset. */
function presetsFor(snap: RoomSnapshot): number[] | undefined {
  const s = snap.room.settings
  if (snap.room.stepKey === 'i1.klaerung')
    return [s.klaerung.minutes, ...s.timerPresetsMin.filter((m) => m !== s.klaerung.minutes)]
  if (snap.room.stepKey === 'i1.pitch')
    return [s.pitch.minutesPerGroup, 1, 3, 5].filter((m, i, a) => a.indexOf(m) === i)
  return undefined
}

function ConsoleStep({
  store,
  state,
  snap,
  me,
}: {
  store: WorkshopStore
  state: StoreState
  snap: RoomSnapshot
  me: Me
}) {
  const roomHref = useRoomHref()
  const [open, setOpen] = useState<string | null>(null)
  const tally = useTally(snap)
  const prioritised = usePrioritised(snap)
  const { room } = snap
  const step = room.stepKey
  const progress = state.progress

  switch (step) {
    case 'lobby': {
      const url = absoluteUrl(roomHref(room.code))
      return (
        <div className="share">
          <QrCode text={url} size={180} label={`${c.shareTitle}: ${url}`} />
          <div>
            <h2>{c.shareTitle}</h2>
            <p className="share__url">{url}</p>
            <CopyButton text={url} label={c.shareLink} />
          </div>
        </div>
      )
    }
    case 'i2.lesen':
      return (
        <>
          <CaseGrid onOpen={setOpen} />
          <CardSheet cardId={open} onClose={() => setOpen(null)} />
        </>
      )
    case 'i2.markieren':
      return (
        <>
          <Progress done={progress?.voted ?? 0} total={progress?.participants ?? 0} verb={r.voted} />
          <p className="muted">{r.projector.hiddenUntilReveal}</p>
        </>
      )
    case 'i2.aufloesen':
      return votesVisible(room) ? (
        <div className="two-col">
          <div>
            <h2>{r.results.ranking}</h2>
            <Ranking tally={tally} limit={8} />
          </div>
          <Heatmap tally={tally} />
        </div>
      ) : null
    case 'i2.diskutieren': {
      const marked = new Map(relevantArchetypes(snap).map((s) => [s.refId, s.id]))
      return (
        <>
          <fieldset className="chips">
            <legend>{c.relevantArchetypes}</legend>
            {archetypes.map((a) => {
              const on = marked.has(a.id)
              const dots = tally.byArchetype.find((x) => x.archetypeId === a.id)?.dots ?? 0
              return (
                <label key={a.id} className="chip-toggle">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      fire(
                        on ? store.unselect(marked.get(a.id)!) : store.select('relevant_archetype', 'archetype', a.id),
                      )
                    }
                  />
                  <span>
                    {r.archetype(a.number)} · {a.title} {votesVisible(room) && <small>({r.results.dots(dots)})</small>}
                  </span>
                </label>
              )
            })}
          </fieldset>
          {DISCUSSION_TOPICS['i2.diskutieren']!.map((topic) => (
            <NotesPanel
              key={topic}
              store={store}
              snap={snap}
              me={me}
              stepKey={step}
              topic={topic}
              title={r.topics[topic]}
            />
          ))}
        </>
      )
    }
    case 'i1.gruppen':
      return <GroupControls store={store} snap={snap} />
    case 'i1.ziehen':
      return <DrawControls store={store} snap={snap} prioritised={room.program === 'komplett' ? prioritised : []} />
    case 'i1.lesen':
    case 'i1.klaerung':
      return <GroupBoard snap={snap} online={state.online} />
    case 'i1.entwickeln':
      return <IdeaWall snap={snap} />
    case 'i1.pitch': {
      const groups = groupsOf(snap)
      const g = room.pitchGroup ?? 1
      return (
        <>
          <div className="pitch-nav">
            <button type="button" className="btn" disabled={g <= 1} onClick={() => fire(store.setPitchGroup(g - 1))}>
              ← {c.prevGroup}
            </button>
            <strong>{c.pitching(g)}</strong>
            <button
              type="button"
              className="btn btn--primary"
              disabled={g >= groups.length}
              onClick={() => fire(store.setPitchGroup(g + 1))}
            >
              {c.nextGroup} →
            </button>
          </div>
          <Ideas snap={snap} groupNo={g} />
        </>
      )
    }
    case 'st.auswaehlen':
      return (
        <>
          <SelectControls store={store} snap={snap} />
          {strategyTargets(snap).length === 0 && <p className="callout">{c.needTarget}</p>}
        </>
      )
    case 'st.diskutieren':
      return (
        <>
          {strategyTargets(snap).map((s) => (
            <section key={s.id} className="target">
              <h2>{selectionLabel(s, snap)}</h2>
              {DISCUSSION_TOPICS['st.diskutieren']!.map((topic) => (
                <NotesPanel
                  key={topic}
                  store={store}
                  snap={snap}
                  me={me}
                  stepKey={step}
                  topic={topic}
                  selectionId={s.id}
                  title={r.topics[topic]}
                />
              ))}
            </section>
          ))}
        </>
      )
    case 'st.bewerten':
      return ratingsVisible(room) ? (
        <div className="two-col">
          <Matrix snap={snap} id="matrix-console" />
          <RatingTable snap={snap} />
        </div>
      ) : (
        <>
          <Progress done={progress?.rated ?? 0} total={progress?.participants ?? 0} verb={r.rated} />
          <button type="button" className="btn btn--primary" onClick={() => fire(store.reveal('st.bewerten'))}>
            {c.reveal}
          </button>
        </>
      )
    case 'st.umsetzung':
      return (
        <>
          {strategyTargets(snap).map((s) => (
            <section key={s.id} className="target">
              <h2>{selectionLabel(s, snap)}</h2>
              <ImplStepsEditor store={store} snap={snap} me={me} selectionId={s.id} />
            </section>
          ))}
        </>
      )
    case 'ende':
      return (
        <p>
          <a className="btn btn--primary" href={roomHref(room.code, 'ergebnis')}>
            {c.summary}
          </a>
        </p>
      )
  }
}

function GroupControls({ store, snap }: { store: WorkshopStore; snap: RoomSnapshot }) {
  const { settings } = snap.room
  const people = snap.members.filter((m) => m.role === 'participant')
  return (
    <>
      <div className="row">
        <label className="field field--inline">
          <span>{c.groupCount}</span>
          <select
            value={settings.groupCount}
            onChange={(e) => fire(store.updateSettings({ ...settings, groupCount: Number(e.target.value) }))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => fire(store.setGroups(balanceGroups(snap.members, settings.groupCount)))}
        >
          {c.autoAssign}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => fire(store.setGroups(shuffleGroups(snap.members, settings.groupCount)))}
        >
          {c.shuffle}
        </button>
      </div>
      <ul className="assign-list">
        {people.map((m) => (
          <li key={m.id}>
            <span>{m.displayName}</span>
            <select
              aria-label={c.assign(m.displayName)}
              value={m.groupNo ?? ''}
              onChange={(e) => fire(store.setGroups({ [m.id]: Number(e.target.value) }))}
            >
              {groupsOf(snap).map((g) => (
                <option key={g} value={g}>
                  {r.group(g)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </>
  )
}

function DrawControls({
  store,
  snap,
  prioritised,
}: {
  store: WorkshopStore
  snap: RoomSnapshot
  prioritised: string[]
}) {
  const suggestion = suggestArchetype(ARCHETYPE_IDS, prioritised, snap.draws)
  return (
    <ul className="draw-groups">
      {groupsOf(snap).map((g) => {
        const d = snap.draws.find((x) => x.groupNo === g)
        const a = getArchetype(d?.archetypeId)
        const card = d ? getCard(`${d.archetypeId}-archetype`) : undefined
        const surface = a ? archetypeSurface(a.colour) : null
        const people = snap.members.filter((m) => m.groupNo === g).map((m) => m.displayName)
        return (
          <li key={g} className="draw-group">
            <div
              className="draw-group__head"
              style={surface ? { background: surface.bg, color: surface.fg } : undefined}
            >
              <strong>{r.group(g)}</strong>
              <span>{people.length ? people.join(', ') : c.drawNoPeople}</span>
            </div>
            <div className="draw-group__body">
              <div className="draw-group__result">
                {card && a ? (
                  <>
                    <CardImage card={card} size="thumb" decorative />
                    <p>
                      <strong>{archetypeShort(a.id)}</strong>
                      <br />
                      {a.title}
                    </p>
                  </>
                ) : (
                  <p className="draw-group__empty">{c.drawPending}</p>
                )}
              </div>
              <div className="draw-group__actions">
                {d ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => fire(store.setDraw(g, null))}
                  >
                    {c.drawReset}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn--primary btn--small" onClick={() => fire(store.draw(g))}>
                      {c.draw}
                    </button>
                    {suggestion?.method === 'priorisiert' && (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => fire(store.setDraw(g, suggestion.archetypeId, 'priorisiert'))}
                      >
                        {c.drawPriority(archetypeShort(suggestion.archetypeId))}
                      </button>
                    )}
                  </>
                )}
              </div>
              <fieldset className="arch-pick">
                <legend>{c.drawManual}</legend>
                {ARCHETYPE_IDS.map((id) => {
                  const arch = getArchetype(id)!
                  const sf = archetypeSurface(arch.colour)
                  const takenBy = snap.draws.find((x) => x.archetypeId === id && x.groupNo !== g)?.groupNo
                  const on = d?.archetypeId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`arch-pick__tile${on ? ' is-on' : ''}`}
                      style={{ background: sf.bg, color: sf.fg }}
                      disabled={takenBy !== undefined || on}
                      aria-pressed={on}
                      title={takenBy ? `${archetypeLabel(id)} – ${r.group(takenBy)}` : archetypeLabel(id)}
                      aria-label={takenBy ? `${archetypeLabel(id)} (${r.group(takenBy)})` : archetypeLabel(id)}
                      onClick={() => fire(store.setDraw(g, id))}
                    >
                      {String(arch.number).padStart(2, '0')}
                      {takenBy !== undefined && <small>G{takenBy}</small>}
                    </button>
                  )
                })}
              </fieldset>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function SelectControls({ store, snap }: { store: WorkshopStore; snap: RoomSnapshot }) {
  const cand = useCandidates(snap)
  const targets = strategyTargets(snap)
  const has = (refType: string, refId: string) => targets.some((s) => s.refType === refType && s.refId === refId)
  const add = (refType: 'archetype' | 'card' | 'idea', refId: string) =>
    fire(store.select('strategy_target', refType, refId))
  const Btn = ({ refType, refId, label }: { refType: 'archetype' | 'card' | 'idea'; refId: string; label: string }) => (
    <li>
      <button
        type="button"
        className="btn btn--small"
        disabled={has(refType, refId)}
        onClick={() => add(refType, refId)}
      >
        + {label}
      </button>
    </li>
  )
  return (
    <div className="two-col">
      <div>
        <h2>{c.selected}</h2>
        {targets.length ? (
          <ol className="target-list">
            {targets.map((s) => (
              <li key={s.id}>
                {selectionLabel(s, snap)}{' '}
                <button type="button" className="btn btn--small btn--ghost" onClick={() => fire(store.unselect(s.id))}>
                  {c.remove}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">{c.nothingSelected}</p>
        )}
      </div>
      <div className="candidates">
        <h2>{c.candidates}</h2>
        {cand.archetypes.length > 0 && (
          <>
            <h3>{c.prioritised}</h3>
            <ul>
              {cand.archetypes.map((a) => (
                <Btn key={a} refType="archetype" refId={a} label={archetypeLabel(a)} />
              ))}
            </ul>
          </>
        )}
        {cand.topCases.length > 0 && (
          <>
            <h3>{c.topCases}</h3>
            <ul>
              {cand.topCases.map((id) => (
                <Btn key={id} refType="card" refId={id} label={cardLabel(id)} />
              ))}
            </ul>
          </>
        )}
        {cand.ideas.length > 0 && (
          <>
            <h3>{c.ideasFromI1}</h3>
            <ul>
              {cand.ideas.map((i) => (
                <Btn
                  key={i.id}
                  refType="idea"
                  refId={i.id}
                  label={`${r.group(i.groupNo)}: ${i.title || r.ideas.untitled}`}
                />
              ))}
            </ul>
          </>
        )}
        <h3>{c.anyArchetype}</h3>
        <ul>
          {archetypes.map((a) => (
            <Btn key={a.id} refType="archetype" refId={a.id} label={archetypeLabel(a.id)} />
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Two-step close button instead of a blocking browser dialog. */
function CloseRoom({ onClose }: { onClose: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking)
    return (
      <button type="button" className="btn btn--accent" onClick={() => setAsking(true)}>
        {c.close}
      </button>
    )
  return (
    <span className="close-confirm" role="group" aria-label={c.close}>
      <span>{c.closeConfirm}</span>
      <button type="button" className="btn btn--accent" onClick={onClose}>
        {c.closeYes}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>
        {c.closeNo}
      </button>
    </span>
  )
}
