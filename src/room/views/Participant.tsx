import { useState } from 'react'
import { getArchetype, getCard } from '../../data/deck'
import { t } from '../../i18n/de'
import { useRoomHref } from '../link'
import { href } from '../../lib/router'
import {
  DISCUSSION_TOPICS,
  IDEA_GOAL,
  LIMITS,
  ratingsVisible,
  votesVisible,
  type Criterion,
  type Me,
  type RoomSnapshot,
} from '../../workshop'
import type { StoreState, WorkshopStore } from '../../workshop/store/types'
import { ArchetypeCards, Ideas } from '../components/blocks'
import { ConnectionBadge, ErrorNote, GroupChip, TimerDisplay } from '../components/basics'
import { ArchetypeStrip, CardSheet, CaseGrid, ReadingSequence, RoomCard } from '../components/cards'
import { IdeaEditor, ImplStepsEditor, NotesPanel, RatingInput } from '../components/inputs'
import { Heatmap, Matrix, Ranking, RatingTable } from '../components/results'
import { useTally } from '../derive'
import { fire } from '../hooks'
import {
  archetypeShort,
  relevantArchetypes,
  selectionArchetype,
  selectionLabel,
  stepHelp,
  stepLabel,
  strategyTargets,
} from '../labels'
import { readingOrder } from '../../workshop/deckRefs'

const r = t.room
const p = r.participant

export function ParticipantView({ store, state }: { store: WorkshopStore; state: StoreState }) {
  const snap = state.snapshot!
  const me = state.me
  const { room } = snap
  const name = snap.members.find((m) => m.id === me.memberId)?.displayName ?? ''
  const draw = me.groupNo ? snap.draws.find((d) => d.groupNo === me.groupNo) : undefined
  return (
    <div className="phone">
      <header className="phone__head">
        <div className="phone__who">
          {me.groupNo ? (
            <GroupChip snap={snap} groupNo={me.groupNo}>
              {draw && <> · {archetypeShort(draw.archetypeId)}</>}
            </GroupChip>
          ) : (
            <span className="phone__name">{name}</span>
          )}
          <span className="phone__step">{stepLabel(room.stepKey)}</span>
        </div>
        <TimerDisplay store={store} timer={room.timer} />
      </header>
      <ConnectionBadge connection={state.connection} />
      <main className="phone__body" id="main" tabIndex={-1}>
        {me.role === 'facilitator' && <p className="callout">{p.facilitatorHere}</p>}
        <h1 className="phone__title">{stepLabel(room.stepKey)}</h1>
        {room.status === 'closed' ? (
          <Closed code={room.code} />
        ) : (
          <>
            <p className="phone__help">{stepHelp(room.stepKey, room.settings.dotsPerPerson)}</p>
            <PhoneStep store={store} snap={snap} me={me} name={name} />
          </>
        )}
      </main>
      <ErrorNote error={state.lastError} />
    </div>
  )
}

function Closed({ code }: { code: string }) {
  const roomHref = useRoomHref()
  return (
    <p>
      <a className="btn btn--primary" href={roomHref(code, 'ergebnis')}>
        {p.summary}
      </a>
    </p>
  )
}

function PhoneStep({ store, snap, me, name }: { store: WorkshopStore; snap: RoomSnapshot; me: Me; name: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const tally = useTally(snap)
  const { room } = snap
  const step = room.stepKey
  const group = me.groupNo
  const draw = group ? snap.draws.find((d) => d.groupNo === group) : undefined
  const sheet = <CardSheet cardId={open} onClose={() => setOpen(null)} />

  switch (step) {
    case 'lobby':
      return (
        <div className="phone__wait">
          <p className="lead">{p.welcome(name)}</p>
          <p>{p.waiting}</p>
          <div className="pulse" aria-hidden="true" />
        </div>
      )
    case 'i2.lesen':
      return (
        <>
          <CaseGrid onOpen={setOpen} />
          {sheet}
        </>
      )
    case 'i2.markieren': {
      const mine = new Set(snap.votes.filter((v) => v.userId === me.userId).map((v) => v.cardId))
      const total = room.settings.dotsPerPerson
      return (
        <>
          <CaseGrid
            onOpen={setOpen}
            voting={{ mine, full: mine.size >= total, onToggle: (id) => fire(store.toggleVote(id)) }}
          />
          {sheet}
          <div className="action-bar action-bar--sticky">
            <span className="dots-counter" aria-live="polite">
              <span className="dots-counter__dots" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={i < mine.size ? 'is-on' : undefined} />
                ))}
              </span>
              {p.dotsLeft(total - mine.size, total)}
            </span>
          </div>
        </>
      )
    }
    case 'i2.aufloesen':
      return votesVisible(room) ? (
        <>
          <h2>{r.results.ranking}</h2>
          <Ranking tally={tally} />
          <Heatmap tally={tally} />
        </>
      ) : null
    case 'i2.diskutieren':
      return (
        <>
          {relevantArchetypes(snap).length > 0 && (
            <>
              <h2>{r.summary.relevant}</h2>
              <ArchetypeStrip ids={relevantArchetypes(snap).map((s) => s.refId)} />
            </>
          )}
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
          <p className="hint">{r.noPersonalData}</p>
        </>
      )
    case 'i1.gruppen':
      return <GroupInfo snap={snap} me={me} />
    case 'i1.ziehen':
      if (!group) return <p>{p.noGroupYet}</p>
      return draw ? (
        <>
          <p>{p.drawn}</p>
          <ArchetypeCards ids={[draw.archetypeId]} />
        </>
      ) : (
        <div className="phone__wait">
          <p>{p.drawWaiting}</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => fire(store.draw(group))}>
            {p.draw}
          </button>
        </div>
      )
    case 'i1.lesen':
    case 'i1.klaerung':
      if (!draw) return <p>{group ? p.drawWaiting : p.noGroupYet}</p>
      return <ReadingSequence archetypeId={draw.archetypeId} />
    case 'i1.entwickeln': {
      if (!group) return <p>{p.noGroupYet}</p>
      const ideas = snap.ideas.filter((i) => i.groupNo === group)
      const cases = draw ? readingOrder(draw.archetypeId).cases : []
      return (
        <>
          <p className="hint">{r.ideas.editingHint}</p>
          <p className={`idea-counter${ideas.length >= IDEA_GOAL.min ? ' is-done' : ''}`} aria-live="polite">
            {r.ideas.counter(ideas.length)}
          </p>
          {ideas.map((idea) => (
            <IdeaEditor key={idea.id} store={store} idea={idea} cases={cases} canEdit />
          ))}
          <p className="hint">{r.noPersonalData}</p>
          <div className="action-bar action-bar--sticky">
            <button
              type="button"
              className="btn btn--primary"
              disabled={ideas.length >= LIMITS.ideasPerGroup}
              onClick={() => fire(store.saveIdea({ groupNo: group, title: '' }))}
            >
              {r.ideas.add}
            </button>
          </div>
        </>
      )
    }
    case 'i1.pitch': {
      const g = room.pitchGroup
      return g ? (
        <>
          {g === group && <p className="callout">{p.yourTurn}</p>}
          <Ideas snap={snap} groupNo={g} />
        </>
      ) : null
    }
    case 'st.auswaehlen': {
      const targets = strategyTargets(snap)
      return targets.length ? (
        <ul className="target-list">
          {targets.map((s) => (
            <li key={s.id}>{selectionLabel(s, snap)}</li>
          ))}
        </ul>
      ) : (
        <p>{p.waitingForSelection}</p>
      )
    }
    case 'st.diskutieren':
      return (
        <>
          {strategyTargets(snap).map((s) => {
            const a = selectionArchetype(s, snap)
            return (
              <section key={s.id} className="target">
                <h2>{selectionLabel(s, snap)}</h2>
                {a && (
                  <div className="target__cards">
                    {[`${a}-technology`, `${a}-organisation`].map((id) => {
                      const c = getCard(id)
                      return c ? <RoomCard key={id} card={c} /> : null
                    })}
                  </div>
                )}
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
            )
          })}
          <p className="hint">{r.noPersonalData}</p>
        </>
      )
    case 'st.bewerten': {
      if (ratingsVisible(room))
        return (
          <>
            <Matrix snap={snap} id="matrix-phone" />
            <RatingTable snap={snap} />
          </>
        )
      if (!strategyTargets(snap).length) return <p className="hint">{p.noTargets}</p>
      return (
        <>
          <p className="hint">{p.rateHint}</p>
          {strategyTargets(snap).map((s) => {
            const mine = Object.fromEntries(
              snap.ratings
                .filter((x) => x.userId === me.userId && x.selectionId === s.id)
                .map((x) => [x.criterion, x.score]),
            ) as Partial<Record<Criterion, number>>
            return (
              <section key={s.id} className="target">
                <h2>{selectionLabel(s, snap)}</h2>
                <RatingInput name={s.id} value={mine} onChange={(c, v) => fire(store.rate(s.id, c, v))} />
              </section>
            )
          })}
        </>
      )
    }
    case 'st.umsetzung':
      return (
        <>
          {strategyTargets(snap).map((s) => (
            <section key={s.id} className="target">
              <h2>{selectionLabel(s, snap)}</h2>
              <ImplStepsEditor store={store} snap={snap} me={me} selectionId={s.id} />
            </section>
          ))}
          <p className="hint">{r.noPersonalData}</p>
        </>
      )
    case 'ende':
      return (
        <p>
          <a className="btn btn--primary" href={href(`/raum/${room.code}/ergebnis`)}>
            {p.summary}
          </a>
        </p>
      )
  }
}

function GroupInfo({ snap, me }: { snap: RoomSnapshot; me: Me }) {
  if (!me.groupNo) return <p>{p.noGroupYet}</p>
  const members = snap.members.filter((m) => m.groupNo === me.groupNo)
  const draw = snap.draws.find((d) => d.groupNo === me.groupNo)
  return (
    <>
      <p className="lead">{p.yourGroup(me.groupNo)}</p>
      {draw && <p>{getArchetype(draw.archetypeId)?.title}</p>}
      <h2>{p.groupMembers}</h2>
      <ul className="name-list">
        {members.map((m) => (
          <li key={m.id}>{m.userId === me.userId ? `${m.displayName} (${r.you})` : m.displayName}</li>
        ))}
      </ul>
    </>
  )
}
