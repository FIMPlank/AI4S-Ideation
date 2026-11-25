import { useState } from 'react'
import type { Paper } from '../../content/parse'
import { t } from '../../i18n/de'
import { apaCitation, doiUrl } from '../../lib/citation'

export function ResearchBadge() {
  return (
    <span className="research-badge">
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5" />
      </svg>
      {t.leitfaden.research}
    </span>
  )
}

export function CitationCard({ paper }: { paper: Paper }) {
  const l = t.leitfaden
  const [status, setStatus] = useState('')
  const apa = apaCitation(paper)

  async function copy() {
    try {
      await navigator.clipboard.writeText(apa)
      setStatus(l.citationCopied)
    } catch {
      window.prompt(l.citationPrompt, apa)
    }
  }

  return (
    <figure className="citation" aria-label={l.citationLabel}>
      <ResearchBadge />
      <blockquote className="citation__body">
        <p className="citation__title">{paper.title}</p>
        <p className="citation__authors">
          {paper.authors.join(', ')} ({paper.year})
        </p>
        <p className="citation__source">
          <cite>{paper.journal}</cite>, {paper.volume}, {paper.pages}
        </p>
        <p className="citation__doi">
          DOI:{' '}
          <a href={doiUrl(paper.doi)} target="_blank" rel="noopener">
            {paper.doi}
          </a>
        </p>
      </blockquote>
      <figcaption className="citation__actions no-print">
        <a className="btn btn--primary btn--small" href={paper.url} target="_blank" rel="noopener">
          {l.paperLink}
        </a>
        <button type="button" className="btn btn--small" onClick={copy}>
          {l.copyCitation}
        </button>
        <output className="share__status">{status}</output>
      </figcaption>
    </figure>
  )
}
