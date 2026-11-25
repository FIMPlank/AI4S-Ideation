import { t } from '../i18n/de'
import { Tile } from './Tile'
import { FOOTER_TILES } from './landing/tiles'

export function Footer() {
  const f = t.footer
  return (
    <footer className="site-footer">
      <div className="tile-band" aria-hidden="true">
        {FOOTER_TILES.map((tile, i) => (
          <Tile key={i} {...tile} />
        ))}
      </div>
      <div className="l-container site-footer__inner">
        <div className="site-footer__about">
          {/* TODO: replace with the FFTT / Fraunhofer logo from public/brand/ */}
          <div className="logo-placeholder">{f.logoPlaceholder}</div>
          <p>{f.about}</p>
        </div>
        <nav aria-label={f.nav} className="site-footer__nav">
          <div>
            <h2 className="site-footer__head">{f.discover}</h2>
            <a href="#/karten">{t.site.navCards}</a>
            <a href="#/spielmodi">{t.site.navModes}</a>
            <a href="#/leitfaden">{t.site.navGuide}</a>
            <a href="#/forschung">{t.site.navResearch}</a>
          </div>
          <div>
            <h2 className="site-footer__head">{f.legal}</h2>
            <a href="#/impressum">{f.impressum}</a>
            <a href="#/datenschutz">{f.privacy}</a>
            {/* no licence page yet: plain text, not a dead link */}
            <span>{f.licence}</span>
          </div>
        </nav>
      </div>
    </footer>
  )
}
