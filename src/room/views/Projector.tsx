import { useEffect, useState } from 'react'
import { archetypes, getArchetype } from '../../data/deck'
import { t } from '../../i18n/de'
import { useRoomHref } from '../link'
import { archetypeSurface } from '../../lib/color'
import { useReducedMotion } from '../../lib/useReducedMotion'
import { absoluteUrl } from '../../lib/router'
import { DISCUSSION_TOPICS, ratingsVisible, stepDef, votesVisible, type RoomSnapshot } from '../../workshop'
import type { StoreState, WorkshopStore } from '../../workshop/store/types'
import { ArchetypeCards, GroupBoard, IdeaWall, Ideas } from '../components/blocks'
import { Progress, QrCode, RoomCode, TimerDisplay } from '../components/basics'
import { ArchetypeStrip } from '../components/cards'
import { Heatmap, Matrix, Ranking, RatingTable } from '../components/results'
import { groupsOf, useTally } from '../derive'
import { relevantArchetypes, selectionLabel, stepHelp, stepLabel, strategyTargets } from '../labels'

const r = t.room
const pj = r.projector

/** Beamer view: no controls, large type, follows the room. */
export function ProjectorView({ store, state }: { store: WorkshopStore; state: StoreState }) {
  const roomHref = useRoomHref()
  const snap = state.snapshot!
  const { room } = snap
  const url = absoluteUrl(roomHref(room.code))
  const def = stepDef(room.stepKey)
  const participants = snap.members.filter((m) => m.role === 'participant')

  if (room.stepKey === 'lobby')
    return (
      <div className="screen screen--lobby">
        <div className="screen__join">
          <p className="eyebrow">{room.title || r.title}</p>
          <h1>{pj.joinAt}</h1>
          <p className="screen__url">{url.replace(/^https?:\/\//, '')}</p>
          <p className="screen__code-label">{pj.code}</p>
          <RoomCode code={room.code} size="xl" />
          <p className="muted">{pj.orScan}</p>
        </div>
        <div className="screen__qr">
          <QrCode text={url} size={360} label={`${pj.joinAt} ${url}`} />
        </div>
        <section className="screen__names" aria-live="polite">
          <h2>{r.participants(participants.length)}</h2>
          {participants.length ? (
            <ul className="name-cloud">
              {participants.map((m) => (
                <li key={m.id}>{m.displayName}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{pj.waiting}</p>
          )}
        </section>
      </div>
    )

  return (
    <div className="screen">
      <header className="screen__head">
        <div>
          {def && <p className="eyebrow">{r.modes[def.mode]}</p>}
          <h1>{stepLabel(room.stepKey)}</h1>
          <p className="screen__help">{stepHelp(room.stepKey, room.settings.dotsPerPerson)}</p>
        </div>
        <TimerDisplay store={store} timer={room.timer} size="xl" />
      </header>
      <main className="screen__body">
        <ScreenStep snap={snap} state={state} />
      </main>
      {/* latecomers: code + QR stay in a corner */}
      <aside className="screen__corner" aria-label={pj.joinAt}>
        <QrCode text={url} size={96} label={`${pj.joinAt} ${url}`} />
        <RoomCode code={room.code} />
      </aside>
    </div>
  )
}

function ScreenStep({ snap, state }: { snap: RoomSnapshot; state: StoreState }) {
  const tally = useTally(snap)
  const { room } = snap
  switch (room.stepKey) {
    case 'i2.lesen':
      return <ArchetypeStrip />
    case 'i2.markieren':
      return (
        <div className="screen__center">
          <Progress done={state.progress?.voted ?? 0} total={state.progress?.participants ?? 0} verb={r.voted} />
          <p className="muted">{pj.hiddenUntilReveal}</p>
        </div>
      )
    case 'i2.aufloesen':
      return votesVisible(room) ? (
        <div className="two-col two-col--screen">
          <div>
            <h2>{r.results.ranking}</h2>
            <Ranking tally={tally} />
          </div>
          <Heatmap tally={tally} />
        </div>
      ) : null
    case 'i2.diskutieren':
      return (
        <div className="two-col two-col--screen">
          <ol className="questions">
            {DISCUSSION_TOPICS['i2.diskutieren']!.map((q) => (
              <li key={q}>
                {r.topics[q]}
                <NoteList snap={snap} topic={q} />
              </li>
            ))}
          </ol>
          {relevantArchetypes(snap).length > 0 && (
            <div>
              <h2>{r.summary.relevant}</h2>
              <ArchetypeStrip ids={relevantArchetypes(snap).map((s) => s.refId)} />
            </div>
          )}
        </div>
      )
    case 'i1.gruppen':
    case 'i1.lesen':
    case 'i1.klaerung':
      return <GroupBoard snap={snap} online={state.online} />
    case 'i1.ziehen':
      return <DrawStage snap={snap} />
    case 'i1.entwickeln':
      return <IdeaWall snap={snap} />
    case 'i1.pitch':
      return room.pitchGroup ? <Ideas snap={snap} groupNo={room.pitchGroup} large /> : null
    case 'st.auswaehlen':
    case 'st.umsetzung':
      return (
        <ol className="targets-big">
          {strategyTargets(snap).map((s) => (
            <li key={s.id}>
              <span>{selectionLabel(s, snap)}</span>
              {room.stepKey === 'st.umsetzung' && (
                <ul>
                  {snap.implSteps
                    .filter((x) => x.selectionId === s.id && x.what)
                    .map((x) => (
                      <li key={x.id}>
                        {x.what}
                        {x.who && ` · ${x.who}`}
                        {x.due && ` · ${new Date(x.due).toLocaleDateString('de-DE')}`}
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )
    case 'st.diskutieren':
      return (
        <div className="two-col two-col--screen">
          <ol className="targets-big">
            {strategyTargets(snap).map((s) => (
              <li key={s.id}>{selectionLabel(s, snap)}</li>
            ))}
          </ol>
          <ol className="questions">
            {DISCUSSION_TOPICS['st.diskutieren']!.map((q) => (
              <li key={q}>{r.topics[q]}</li>
            ))}
          </ol>
        </div>
      )
    case 'st.bewerten':
      return ratingsVisible(room) ? (
        <div className="two-col two-col--screen">
          <Matrix snap={snap} id="matrix-screen" />
          <RatingTable snap={snap} />
        </div>
      ) : (
        <div className="screen__center">
          <Progress done={state.progress?.rated ?? 0} total={state.progress?.participants ?? 0} verb={r.rated} />
          <p className="muted">{pj.hiddenUntilReveal}</p>
        </div>
      )
    case 'ende':
      return (
        <>
          {strategyTargets(snap).length > 0 && ratingsVisible(snap.room) ? (
            <div className="two-col">
              <Matrix snap={snap} id="matrix-end" />
              <RatingTable snap={snap} />
            </div>
          ) : (
            snap.ideas.length > 0 && <IdeaWall snap={snap} />
          )}
          <p className="screen__note">{r.projector.endHint}</p>
        </>
      )
    default:
      return null
  }
}

function NoteList({ snap, topic }: { snap: RoomSnapshot; topic: string }) {
  const notes = snap.notes.filter((n) => n.topic === topic && n.stepKey === snap.room.stepKey)
  return notes.length ? (
    <ul className="note-chips">
      {notes.map((n) => (
        <li key={n.id}>{n.body}</li>
      ))}
    </ul>
  ) : null
}

/** Per group: a short shuffle through the archetype colours, then the drawn card. */
function DrawStage({ snap }: { snap: RoomSnapshot }) {
  return (
    <ul className="draw-stage">
      {groupsOf(snap).map((g) => {
        const d = snap.draws.find((x) => x.groupNo === g)
        return (
          <li key={g}>
            <h2>{r.group(g)}</h2>
            {d ? (
              <DrawReveal key={d.archetypeId} archetypeId={d.archetypeId} />
            ) : (
              <div className="draw-stage__slot" aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function DrawReveal({ archetypeId }: { archetypeId: string }) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(reduced ? -1 : 0)
  useEffect(() => {
    if (reduced) return
    let n = 0
    const id = setInterval(() => {
      n++
      if (n > 9) {
        clearInterval(id)
        setI(-1)
      } else setI(n)
    }, 110)
    return () => clearInterval(id)
  }, [reduced])
  if (i >= 0) {
    const a = archetypes[i % archetypes.length]
    const s = archetypeSurface(a.colour)
    return (
      <div className="draw-stage__slot is-spinning" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
        {r.archetype(a.number)}
      </div>
    )
  }
  const a = getArchetype(archetypeId)
  return (
    <div className="draw-stage__card" aria-live="polite">
      <ArchetypeCards ids={[archetypeId]} />
      <p>{a?.title}</p>
    </div>
  )
}
