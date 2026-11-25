import type { Paper } from '../content/parse'

/** "Anna M. Oberländer" → "Oberländer, A. M." */
function apaAuthor(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts.pop() ?? ''
  const initials = parts
    .map((p) =>
      p
        .split('-')
        .map((x) => `${x[0]}.`)
        .join('-'),
    )
    .join(' ')
  return initials ? `${last}, ${initials}` : last
}

function joinAuthors(names: string[]): string {
  const a = names.map(apaAuthor)
  if (a.length <= 1) return a.join('')
  return `${a.slice(0, -1).join(', ')}, & ${a.at(-1)}`
}

export const doiUrl = (doi: string) => `https://doi.org/${doi}`

/** APA 7 reference for a journal article. */
export function apaCitation(p: Paper): string {
  return `${joinAuthors(p.authors)} (${p.year}). ${p.title}. ${p.journal}, ${p.volume}, ${p.pages}. ${doiUrl(p.doi)}`
}
