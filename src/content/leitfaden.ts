import doc from 'virtual:leitfaden'
import type { Block, ListItem, Section } from './parse'

/** The brochure, parsed at build time from src/content/leitfaden.de.md. */
export const leitfaden = doc

export const sectionById = (id: string): Section | undefined => doc.sections.find((s) => s.id === id)

export const paragraphs = (s: Section | undefined): Extract<Block, { kind: 'p' }>[] =>
  (s?.blocks ?? []).filter((b): b is Extract<Block, { kind: 'p' }> => b.kind === 'p')

export const firstList = (s: Section | undefined): ListItem[] =>
  (s?.blocks.find((b) => b.kind === 'list') as Extract<Block, { kind: 'list' }> | undefined)?.items ?? []
