import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLeitfaden, splitFrontmatter } from './parse'

const FM = `---
title: T
status: konzept
cover: { headline: H, subline: S }
paper: { authors: [A B], year: 2026, title: P, journal: J, volume: 1, pages: 1–2, doi: 10.1/x, url: https://x.org/p }
openIssues:
  - "eins"
---
`

describe('splitFrontmatter', () => {
  it('reads YAML and returns the body', () => {
    const { data, body } = splitFrontmatter(FM + '# A {#a}\n')
    expect(data).toMatchObject({ title: 'T', status: 'konzept', openIssues: ['eins'] })
    expect(body).toBe('# A {#a}\n')
  })
  it('treats a file without frontmatter as body only', () => {
    expect(splitFrontmatter('# A').body).toBe('# A')
  })
})

describe('parseLeitfaden', () => {
  it('turns {#id} headings into sections with ids and levels', () => {
    const doc = parseLeitfaden(FM + '# Einleitung {#einleitung}\n\n## Hintergrund & Vision {#hintergrund}\n\nText.\n')
    expect(doc.sections.map((s) => [s.id, s.level, s.title])).toEqual([
      ['einleitung', 1, 'Einleitung'],
      ['hintergrund', 2, 'Hintergrund & Vision'],
    ])
    expect(doc.sections[1].blocks).toEqual([{ kind: 'p', html: 'Text.' }])
  })
  it('keeps text word for word and escapes HTML', () => {
    const doc = parseLeitfaden(FM + '# A {#a}\n\nerhält Teams „Out-of-the-box“ <b>x</b> – (~ 15min)\n')
    expect(doc.sections[0].blocks[0]).toEqual({
      kind: 'p',
      html: 'erhält Teams „Out-of-the-box“ &lt;b&gt;x&lt;/b&gt; – (~ 15min)',
    })
  })
  it('splits bold labels off list items', () => {
    const doc = parseLeitfaden(FM + '# A {#a}\n\n1. **Schritt eins:** Lesen Sie.\n2. Ohne Label\n')
    expect(doc.sections[0].blocks[0]).toEqual({
      kind: 'list',
      ordered: true,
      items: [{ label: 'Schritt eins', html: 'Lesen Sie.' }, { html: 'Ohne Label' }],
    })
  })
  it('rewrites anchors to hash routes and opens external links in a new tab', () => {
    const doc = parseLeitfaden(FM + '# A {#a}\n\ns. [Spielmodi](#spielmodi)\n\n[Paper](https://x.org/p)\n')
    expect(doc.sections[0].blocks[0]).toEqual({ kind: 'p', html: 's. <a href="#/leitfaden/spielmodi">Spielmodi</a>' })
    expect(doc.sections[0].blocks[1]).toEqual({
      kind: 'p',
      html: '<a href="https://x.org/p" target="_blank" rel="noopener">Paper</a>',
      linkOnly: 'https://x.org/p',
    })
  })
  it('ignores HTML comments (empty sections stay empty)', () => {
    const doc = parseLeitfaden(FM + '## Leer {#leer}\n\n<!-- später -->\n')
    expect(doc.sections[0].blocks).toEqual([])
  })
  it('rejects headings without id, duplicate ids and missing frontmatter', () => {
    expect(() => parseLeitfaden(FM + '# Ohne Id\n')).toThrow(/no \{#id\}/)
    expect(() => parseLeitfaden(FM + '# A {#a}\n## B {#a}\n')).toThrow(/duplicate/)
    expect(() => parseLeitfaden('# A {#a}\n')).toThrow(/missing/)
  })
})

describe('src/content/leitfaden.de.md', () => {
  const doc = parseLeitfaden(readFileSync('src/content/leitfaden.de.md', 'utf8'))
  const byId = new Map(doc.sections.map((s) => [s.id, s]))
  it('has the sections the Leitfaden page builds on', () => {
    const needed = [
      'einleitung',
      'motivation',
      'kernvorteile',
      'hintergrund',
      'kartenset',
      'getting-started',
      'vorbereitung',
      'ressourcen',
      'allgemeine-vorbereitung',
      'spielmodi',
    ]
    expect(needed.filter((id) => !byId.has(id))).toEqual([])
  })
  it('has 4 Kernvorteile with labels, 4 usage-phase paragraphs and 4 numbered prep steps', () => {
    const list = (id: string) => byId.get(id)!.blocks.find((b) => b.kind === 'list')
    expect(list('kernvorteile')).toMatchObject({ ordered: false })
    expect(list('kernvorteile')!.kind === 'list' && list('kernvorteile')!.items.every((i) => i.label)).toBe(true)
    expect(byId.get('vorbereitung')!.blocks.filter((b) => b.kind === 'p')).toHaveLength(4)
    const steps = list('allgemeine-vorbereitung')
    expect(steps?.kind === 'list' && steps.ordered && steps.items.length).toBe(4)
  })
  it('reads the paper citation and open issues from the frontmatter', () => {
    expect(doc.meta.status).toBe('konzept')
    expect(doc.meta.paper.doi).toBe('10.17705/1CAIS.05824')
    expect(doc.meta.openIssues.length).toBeGreaterThan(0)
  })
})
