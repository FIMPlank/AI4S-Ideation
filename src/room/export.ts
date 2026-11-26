/** CSV and PNG export of a room's results. Votes and ratings only aggregated, without names. */
import { getArchetype } from '../data/deck'
import { t } from '../i18n/de'
import { CRITERIA, summarizeRatings, type RoomSnapshot, type VoteTally } from '../workshop'
import { archetypeShort, cardLabel, selectionLabel, stepLabel, strategyTargets } from './labels'

const r = t.room
const ex = r.export

/** RFC 4180 with ";" (what German Excel expects), CRLF, and a BOM so umlauts survive. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? v.toLocaleString('de-DE') : v
    // neutralise spreadsheet formulas in user text
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

export interface CsvFile {
  name: string
  content: string
}

const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100)

export function resultFiles(snap: RoomSnapshot, tally: VoteTally): CsvFile[] {
  const base = `live-raum-${snap.room.code}`
  const group = (n: number) => {
    const d = snap.draws.find((x) => x.groupNo === n)
    return d ? `${r.group(n)} (${archetypeShort(d.archetypeId)})` : r.group(n)
  }
  return [
    {
      name: `${base}-ideen.csv`,
      content: toCsv([
        [ex.group, r.ideas.title, r.ideas.description, r.ideas.inspiredBy, r.ideas.target],
        ...snap.ideas.map((i) => [group(i.groupNo), i.title, i.description, cardLabel(i.inspiredBy), i.target]),
      ]),
    },
    {
      name: `${base}-punkte.csv`,
      content: toCsv([
        [ex.rank, t.cardTypes.case.one, t.cardTypes.archetype.one, ex.dots],
        ...tally.byCase.map((c) => [c.rank, cardLabel(c.cardId), archetypeShort(c.archetypeId), c.dots]),
        [],
        [ex.rank, t.cardTypes.archetype.one, '', ex.dots],
        ...tally.byArchetype.map((a) => [
          a.rank,
          `${archetypeShort(a.archetypeId)} · ${getArchetype(a.archetypeId)?.title ?? ''}`,
          '',
          a.dots,
        ]),
      ]),
    },
    {
      name: `${base}-bewertungen.csv`,
      content: toCsv([
        [r.results.item, ex.criterion, ex.count, r.results.mean, ex.min, ex.max, ex.sd],
        ...strategyTargets(snap).flatMap((s) => {
          const sum = summarizeRatings(snap.ratings, s.id)
          return CRITERIA.map((c) => [
            selectionLabel(s, snap),
            r.criteria[c],
            sum[c].n,
            round(sum[c].mean),
            sum[c].min,
            sum[c].max,
            round(sum[c].sd),
          ])
        }),
      ]),
    },
    {
      name: `${base}-notizen.csv`,
      content: toCsv([
        [ex.step, ex.question, r.results.item, ex.text, ex.byFacilitator],
        ...snap.notes.map((n) => {
          const sel = snap.selections.find((s) => s.id === n.selectionId)
          return [
            stepLabel(n.stepKey),
            r.topics[n.topic] ?? n.topic,
            sel ? selectionLabel(sel, snap) : '',
            n.body,
            n.byFacilitator ? ex.yes : ex.no,
          ]
        }),
      ]),
    },
    {
      name: `${base}-umsetzungsschritte.csv`,
      content: toCsv([
        [r.results.item, r.impl.what, r.impl.who, r.impl.due],
        ...strategyTargets(snap).flatMap((s) =>
          snap.implSteps
            .filter((x) => x.selectionId === s.id)
            .sort((a, b) => a.position - b.position)
            .map((x) => [selectionLabel(s, snap), x.what, x.who, x.due]),
        ),
      ]),
    },
  ]
}

export function download(name: string, data: Blob) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadCsv = (f: CsvFile) => download(f.name, new Blob([f.content], { type: 'text/csv;charset=utf-8' }))

/** Renders an inline SVG (the matrix) to a 2× PNG. No library needed. */
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const { width, height } = svg.viewBox.baseVal
  const xml = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
  )
}
