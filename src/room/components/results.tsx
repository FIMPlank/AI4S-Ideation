import { getArchetype, getCard } from '../../data/deck'
import { t } from '../../i18n/de'
import { displayTitle } from '../../lib/cardInfo'
import { archetypeSurface } from '../../lib/color'
import {
  bubbleRadius,
  CRITERIA,
  matrixPoints,
  summarizeRatings,
  type RoomSnapshot,
  type VoteTally,
} from '../../workshop'
import { selectionLabel, strategyTargets } from '../labels'

const res = t.room.results

export function Ranking({ tally, limit = 5 }: { tally: VoteTally; limit?: number }) {
  const top = tally.byCase.filter((c) => c.dots > 0).slice(0, limit)
  if (!top.length) return <p className="muted">{res.noVotes}</p>
  return (
    <ol className="ranking">
      {top.map((c) => {
        const card = getCard(c.cardId)!
        const a = getArchetype(c.archetypeId)!
        return (
          <li key={c.cardId} style={{ ['--arch' as string]: a.colour }}>
            <span className="ranking__rank" aria-label={res.rank(c.rank)}>
              {c.rank}
            </span>
            <span className="ranking__title">
              {displayTitle(card)}
              <small>{t.room.archetype(a.number)}</small>
            </span>
            <span className="ranking__dots">{res.dots(c.dots)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Dots per archetype (rows) and case (columns); a real table, so it reads well without colour. */
export function Heatmap({ tally }: { tally: VoteTally }) {
  const max = Math.max(1, tally.maxCaseDots)
  return (
    <table className="heatmap">
      <caption>{res.heatmap}</caption>
      <thead>
        <tr>
          <th scope="col">{t.cardTypes.archetype.one}</th>
          {[1, 2, 3, 4].map((n) => (
            <th key={n} scope="col">
              {t.cardTypes.case.one} {n}
            </th>
          ))}
          <th scope="col">{res.byArchetype}</th>
        </tr>
      </thead>
      <tbody>
        {[...tally.byArchetype]
          .sort((a, b) => getArchetype(a.archetypeId)!.number - getArchetype(b.archetypeId)!.number)
          .map((row) => {
            const a = getArchetype(row.archetypeId)!
            const s = archetypeSurface(a.colour)
            return (
              <tr key={a.id}>
                <th scope="row">
                  <span className="heatmap__swatch" style={{ background: a.colour }} aria-hidden="true" />
                  {t.room.archetype(a.number)}
                </th>
                {row.cases.map((c) => (
                  <td
                    key={c.cardId}
                    title={displayTitle(getCard(c.cardId)!)}
                    style={
                      c.dots
                        ? {
                            background: `color-mix(in srgb, ${s.bg} ${20 + (c.dots / max) * 80}%, white)`,
                            color: c.dots / max > 0.55 ? s.fg : 'var(--ink)',
                          }
                        : undefined
                    }
                  >
                    {c.dots}
                  </td>
                ))}
                <td className="heatmap__sum">
                  <strong>{row.dots}</strong>
                  {row.dots > 0 && <span className="heatmap__rank"> · {res.rank(row.rank)}</span>}
                </td>
              </tr>
            )
          })}
      </tbody>
    </table>
  )
}

const fmt = (v: number | null) =>
  v === null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export function RatingTable({ snap }: { snap: RoomSnapshot }) {
  const targets = strategyTargets(snap)
  return (
    <table className="rating-table">
      <caption>{res.table}</caption>
      <thead>
        <tr>
          <th scope="col">{res.item}</th>
          {CRITERIA.map((c) => (
            <th key={c} scope="col">
              {t.room.criteria[c]}
              <small>
                {res.mean} ({res.spread})
              </small>
            </th>
          ))}
          <th scope="col">{res.raters}</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((s) => {
          const sum = summarizeRatings(snap.ratings, s.id)
          return (
            <tr key={s.id}>
              <th scope="row">{selectionLabel(s, snap)}</th>
              {CRITERIA.map((c) => (
                <td key={c}>
                  {fmt(sum[c].mean)}{' '}
                  {sum[c].n > 0 && (
                    <small>
                      ({sum[c].min}–{sum[c].max})
                    </small>
                  )}
                </td>
              ))}
              <td>{sum.raters}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** x = Umsetzbarkeit, y = Geschäftsnutzen, bubble area and colour intensity = Nachhaltigkeitswirkung. */
export function Matrix({ snap, id = 'matrix' }: { snap: RoomSnapshot; id?: string }) {
  const W = 640
  const H = 480
  const pad = { l: 64, r: 24, t: 24, b: 56 }
  const x = (v: number) => pad.l + ((v - 1) / 4) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - ((v - 1) / 4) * (H - pad.t - pad.b)
  const pts = matrixPoints(snap.selections, snap.ratings)
  const labels = new Map(strategyTargets(snap).map((s, i) => [s.id, { n: i + 1, label: selectionLabel(s, snap) }]))
  return (
    <figure className="matrix">
      <svg
        id={id}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-title`}
        xmlns="http://www.w3.org/2000/svg"
        fontFamily="Source Sans 3, system-ui, sans-serif"
      >
        <title id={`${id}-title`}>{`${t.room.projector.matrix}: ${res.axisX} × ${res.axisY}. ${res.bubble}.`}</title>
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={pad.t} y2={H - pad.b} stroke="#e3e7ea" />
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e3e7ea" />
            <text x={x(v)} y={H - pad.b + 20} textAnchor="middle" fontSize="14" fill="#5a6672">
              {v}
            </text>
            <text x={pad.l - 12} y={y(v) + 5} textAnchor="end" fontSize="14" fill="#5a6672">
              {v}
            </text>
          </g>
        ))}
        <line x1={x(3)} x2={x(3)} y1={pad.t} y2={H - pad.b} stroke="#5a6672" strokeDasharray="4 4" />
        <line x1={pad.l} x2={W - pad.r} y1={y(3)} y2={y(3)} stroke="#5a6672" strokeDasharray="4 4" />
        <text x={(pad.l + W - pad.r) / 2} y={H - 12} textAnchor="middle" fontSize="16" fontWeight="700" fill="#16202a">
          {res.axisX} →
        </text>
        <text
          transform={`translate(18 ${(pad.t + H - pad.b) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#16202a"
        >
          {res.axisY} →
        </text>
        {[...pts]
          .sort((a, b) => b.size - a.size)
          .map((pt) => {
            const l = labels.get(pt.selectionId)!
            const alpha = 0.35 + ((pt.size - 1) / 4) * 0.6
            return (
              <g key={pt.selectionId}>
                <circle
                  cx={x(pt.x)}
                  cy={y(pt.y)}
                  r={bubbleRadius(pt.size)}
                  fill={`rgba(10, 127, 102, ${alpha})`}
                  stroke="#0a7f66"
                  strokeWidth="2"
                />
                <text
                  x={x(pt.x)}
                  y={y(pt.y) + 6}
                  textAnchor="middle"
                  fontSize="17"
                  fontWeight="800"
                  fill={alpha > 0.6 ? '#ffffff' : '#16202a'}
                >
                  {l.n}
                </text>
              </g>
            )
          })}
      </svg>
      <figcaption>
        <ol className="matrix__legend">
          {[...labels.values()].map((l) => (
            <li key={l.n}>
              <strong>{l.n}</strong> {l.label}
            </li>
          ))}
        </ol>
        <p className="muted">{res.bubble}</p>
      </figcaption>
    </figure>
  )
}
