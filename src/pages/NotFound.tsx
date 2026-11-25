import { t } from '../i18n/de'

export function NotFound() {
  return (
    <div className="container section">
      <h1>{t.notFound.title}</h1>
      <p>
        {t.notFound.text} <a href="#/karten">{t.notFound.back}</a>
      </p>
    </div>
  )
}
