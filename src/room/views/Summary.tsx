import { t } from '../../i18n/de'
import { useRoomHref } from '../link'
import { DISCUSSION_TOPICS, ratingsVisible, votesVisible, type RoomSnapshot } from '../../workshop'
import type { StoreState } from '../../workshop/store/types'
import { IdeaWall } from '../components/blocks'
import { ArchetypeStrip } from '../components/cards'
import { Heatmap, Matrix, Ranking, RatingTable } from '../components/results'
import { useTally } from '../derive'
import { download, downloadCsv, resultFiles, svgToPng } from '../export'
import { fire } from '../hooks'
import { formatDate, relevantArchetypes, selectionLabel, strategyTargets } from '../labels'

const r = t.room
const s = r.summary

/** End of the room: a summary for everyone; the facilitator also exports. Prints on 1–2 pages. */
export function SummaryView({ state }: { state: StoreState }) {
  const roomHref = useRoomHref()
  const snap = state.snapshot!
  const { room } = snap
  const tally = useTally(snap)
  const isFac = state.me.role === 'facilitator'
  const targets = strategyTargets(snap)
  const hasVotes = votesVisible(room) && tally.totalDots > 0
  return (
    <div className="summary container">
      <header className="summary__head">
        <p className="eyebrow">
          {r.title} · {room.code}
        </p>
        <h1>
          {s.title}
          {room.title && `: ${room.title}`}
        </h1>
        <p className="muted">{s.expires(formatDate(room.expiresAt))}</p>
        <div className="summary__actions no-print">
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            {s.print}
          </button>
          <a className="btn btn--ghost" href={roomHref(room.code, isFac ? 'moderation' : 'teilnehmer')}>
            ← {r.title}
          </a>
        </div>
        {isFac && <ExportMenu snap={snap} />}
      </header>

      {relevantArchetypes(snap).length > 0 && (
        <section>
          <h2>{s.relevant}</h2>
          <ArchetypeStrip ids={relevantArchetypes(snap).map((x) => x.refId)} />
        </section>
      )}
      {hasVotes && (
        <section className="two-col">
          <div>
            <h2>{s.topCases}</h2>
            <Ranking tally={tally} />
          </div>
          <Heatmap tally={tally} />
        </section>
      )}
      <Notes snap={snap} keys={DISCUSSION_TOPICS['i2.diskutieren']!} stepKey="i2.diskutieren" />
      {snap.ideas.length > 0 && (
        <section>
          <h2>{s.ideas}</h2>
          <IdeaWall snap={snap} />
        </section>
      )}
      {targets.length > 0 && ratingsVisible(room) && (
        <section className="two-col summary__matrix">
          <div>
            <h2>{s.strategy}</h2>
            <Matrix snap={snap} id="matrix-summary" />
          </div>
          <RatingTable snap={snap} />
        </section>
      )}
      {snap.implSteps.length > 0 && (
        <section>
          <h2>{s.steps}</h2>
          <table className="impl-table">
            <thead>
              <tr>
                <th scope="col">{r.results.item}</th>
                <th scope="col">{r.impl.what}</th>
                <th scope="col">{r.impl.who}</th>
                <th scope="col">{r.impl.due}</th>
              </tr>
            </thead>
            <tbody>
              {targets.flatMap((sel) =>
                snap.implSteps
                  .filter((x) => x.selectionId === sel.id)
                  .map((x) => (
                    <tr key={x.id}>
                      <td>{selectionLabel(sel, snap)}</td>
                      <td>{x.what}</td>
                      <td>{x.who}</td>
                      <td>{x.due ? new Date(x.due).toLocaleDateString('de-DE') : ''}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </section>
      )}
      {!hasVotes && !snap.ideas.length && !targets.length && <p>{s.empty}</p>}
    </div>
  )
}

function Notes({ snap, keys, stepKey }: { snap: RoomSnapshot; keys: readonly string[]; stepKey: string }) {
  const notes = snap.notes.filter((n) => n.stepKey === stepKey)
  if (!notes.length) return null
  return (
    <section>
      <h2>{s.notes}</h2>
      {keys.map((k) => {
        const list = notes.filter((n) => n.topic === k)
        return list.length ? (
          <div key={k}>
            <h3>{r.topics[k]}</h3>
            <ul>
              {list.map((n) => (
                <li key={n.id}>{n.body}</li>
              ))}
            </ul>
          </div>
        ) : null
      })}
    </section>
  )
}

function ExportMenu({ snap }: { snap: RoomSnapshot }) {
  const tally = useTally(snap)
  const ex = r.export
  const files = resultFiles(snap, tally)
  const labels = [ex.ideas, ex.votes, ex.ratings, ex.notes, ex.steps]
  return (
    <section className="export no-print" aria-labelledby="export-title">
      <h2 id="export-title">{ex.title}</h2>
      <div className="row">
        {files.map((f, i) => (
          <button key={f.name} type="button" className="btn btn--small" onClick={() => downloadCsv(f)}>
            {ex.csv(labels[i])}
          </button>
        ))}
        {ratingsVisible(snap.room) && strategyTargets(snap).length > 0 && (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              const svg = document.getElementById('matrix-summary')
              if (svg instanceof SVGSVGElement)
                fire(svgToPng(svg).then((b) => download(`live-raum-${snap.room.code}-matrix.png`, b)))
            }}
          >
            {ex.png}
          </button>
        )}
      </div>
      <p className="muted">{ex.hint}</p>
    </section>
  )
}
