import { MODES } from '../../config/modes'
import { guideCards } from '../../data/deck'
import { t } from '../../i18n/de'
import { CardImage } from '../CardImage'

/** The three play modes in brochure order, each with its printed guide card. */
export function ModeCards({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const H = `h${headingLevel}` as 'h3' | 'h4'
  const guides = guideCards()
  return (
    <ul className="mode-cards">
      {MODES.map((m) => {
        const card = guides.find((g) => g.mode === m.cardMode)
        if (!card) return null
        return (
          <li key={m.id} className="mode-card">
            <a
              className="mode-card__thumb"
              href={`#/karte/${card.id}?liste=anleitung`}
              tabIndex={-1}
              aria-hidden="true"
            >
              <CardImage card={card} decorative />
            </a>
            <div className="mode-card__body">
              <H>{m.name}</H>
              {m.printedName !== m.name && <p className="mode-card__hint">{t.modes.printedHint(m.printedName)}</p>}
              <dl>
                <dt>{t.landing.modeWhat}</dt>
                <dd>{card.what}</dd>
                <dt>{t.landing.modeWhen}</dt>
                <dd>{card.when}</dd>
              </dl>
              <p className="mode-card__actions">
                {m.available ? (
                  <a className="btn btn--primary btn--small" href={`#/modus/${m.id}`}>
                    {m.name}
                  </a>
                ) : (
                  <span className="badge">{t.modes.soon}</span>
                )}
                <a href={`#/karte/${card.id}?liste=anleitung`}>
                  {t.modes.showCard}
                  <span className="visually-hidden">: {m.name}</span>
                </a>
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
