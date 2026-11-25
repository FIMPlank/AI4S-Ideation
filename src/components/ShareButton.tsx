import { useState } from 'react'
import { t } from '../i18n/de'

/** Web Share API, falling back to copying the link. */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState('')

  async function share() {
    setStatus('')
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus(t.viewer.copied)
    } catch {
      window.prompt(t.viewer.copyPrompt, url)
    }
  }

  return (
    <span className="share">
      <button type="button" className="btn" onClick={share}>
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
        </svg>
        {t.viewer.share}
      </button>
      <output className="share__status">{status}</output>
    </span>
  )
}
