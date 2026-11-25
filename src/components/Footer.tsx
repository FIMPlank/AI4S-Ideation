import { t } from '../i18n/de'

export function Footer() {
  const f = t.footer
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p>
          {f.publishedBy}{' '}
          <strong>
            {t.site.publisher} ({t.site.publisherShort})
          </strong>{' '}
          {f.with} <strong>{t.site.institute}</strong>
        </p>
        <p>{f.licence}</p>
        <nav aria-label={f.legalNav}>
          <ul>
            <li>
              <a href="#/impressum">{f.impressum}</a>
            </li>
            <li>
              <a href="#/datenschutz">{f.privacy}</a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
