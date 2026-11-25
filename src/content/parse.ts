/**
 * Build-time parser for the Leitfaden (brochure) Markdown: YAML frontmatter +
 * Markdown with explicit heading ids ("# Titel {#id}"). Runs in Node inside the
 * Vite plugin (see vite.config.ts), so the browser only gets the parsed result.
 * Text is passed through unchanged; only link targets are adapted to hash routing.
 */
import MarkdownIt, { type Token } from 'markdown-it'
import attrs from 'markdown-it-attrs'
import { parse as parseYaml } from 'yaml'

export interface Paper {
  authors: string[]
  year: number
  title: string
  journal: string
  volume: number
  pages: string
  doi: string
  url: string
}

export interface LeitfadenMeta {
  title: string
  source: string
  status: 'konzept' | 'final'
  cover: { headline: string; subline: string }
  paper: Paper
  openIssues: string[]
  /** Where the web text deviates from the concept PDF (the printed cards are the reference). */
  webChanges: string[]
}

export interface ListItem {
  /** Bold lead-in without its trailing colon, e.g. "Systematischer Transfer". */
  label?: string
  /** Rest of the item as inline HTML. */
  html: string
}

export type Block =
  | { kind: 'p'; html: string; /** set when the paragraph is nothing but one link */ linkOnly?: string }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }

export interface Section {
  id: string
  /** Markdown heading level: 1 = "#", 2 = "##", 3 = "###". */
  level: 1 | 2 | 3
  title: string
  blocks: Block[]
}

export interface LeitfadenDoc {
  meta: LeitfadenMeta
  sections: Section[]
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function splitFrontmatter(src: string): { data: unknown; body: string } {
  const m = FRONTMATTER.exec(src)
  if (!m) return { data: {}, body: src }
  return { data: parseYaml(m[1]), body: src.slice(m[0].length) }
}

function validateMeta(data: unknown): LeitfadenMeta {
  const d = data as Partial<LeitfadenMeta>
  const missing = (['title', 'status', 'cover', 'paper'] as const).filter((k) => d?.[k] === undefined)
  if (missing.length) throw new Error(`leitfaden frontmatter: missing ${missing.join(', ')}`)
  if (d.status !== 'konzept' && d.status !== 'final')
    throw new Error(`leitfaden frontmatter: unknown status "${d.status}"`)
  return { openIssues: [], webChanges: [], source: '', ...d } as LeitfadenMeta
}

function createMd() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false })
  md.use(attrs, { allowedAttributes: ['id'] })
  // In-document anchors (#spielmodi) become hash routes; external links open in a new tab.
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const t = tokens[idx]
    const href = String(t.attrGet('href') ?? '')
    if (/^#[\w-]+$/.test(href)) t.attrSet('href', `#/leitfaden/${href.slice(1)}`)
    else if (/^https?:/.test(href)) {
      t.attrSet('target', '_blank')
      t.attrSet('rel', 'noopener')
    }
    return self.renderToken(tokens, idx, options)
  }
  return md
}

const md = createMd()

function renderInline(children: Token[]): string {
  return md.renderer.renderInline(children, md.options, {}).trim()
}

function listItem(inline: Token): ListItem {
  const c = (inline.children ?? []).filter((t, i) => !(i === 0 && t.type === 'text' && t.content === ''))
  if (c[0]?.type === 'strong_open') {
    const close = c.findIndex((t) => t.type === 'strong_close')
    const label = renderInline(c.slice(1, close)).replace(/:\s*$/, '').trim()
    return { label, html: renderInline(c.slice(close + 1)) }
  }
  return { html: renderInline(c) }
}

export function parseLeitfaden(src: string): LeitfadenDoc {
  const { data, body } = splitFrontmatter(src)
  const meta = validateMeta(data)
  // HTML comments are notes for editors (e.g. "leer in der Konzept-Broschüre"), not content
  const tokens = md.parse(body.replace(/<!--[\s\S]*?-->/g, ''), {})
  const sections: Section[] = []
  const ids = new Set<string>()
  let list: Extract<Block, { kind: 'list' }> | null = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'heading_open') {
      const level = Number(t.tag.slice(1))
      const id = t.attrGet('id')?.toString()
      const title = tokens[i + 1].content.replace(/\s*\{#[\w-]+\}\s*$/, '').trim()
      if (!id) throw new Error(`leitfaden: heading "${title}" has no {#id}`)
      if (ids.has(id)) throw new Error(`leitfaden: duplicate heading id "${id}"`)
      if (level < 1 || level > 3) throw new Error(`leitfaden: heading "${title}" is deeper than ###`)
      ids.add(id)
      sections.push({ id, level: level as 1 | 2 | 3, title, blocks: [] })
      i += 2
      continue
    }
    const current = sections.at(-1)
    if (!current) {
      if (t.type === 'inline' && t.content.trim()) throw new Error('leitfaden: text before the first heading')
      continue
    }
    if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
      list = { kind: 'list', ordered: t.type === 'ordered_list_open', items: [] }
      current.blocks.push(list)
    } else if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') {
      list = null
    } else if (t.type === 'inline' && list) {
      list.items.push(listItem(t))
    } else if (t.type === 'inline') {
      const c = t.children ?? []
      const html = renderInline(c)
      const onlyLink = c.length === 3 && c[0].type === 'link_open' && c[2].type === 'link_close'
      current.blocks.push(
        onlyLink ? { kind: 'p', html, linkOnly: String(c[0].attrGet('href') ?? '') } : { kind: 'p', html },
      )
    }
  }
  return { meta, sections }
}
