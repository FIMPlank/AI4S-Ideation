import { activationCards, archetypes, cards, cardsByArchetype, guideCards } from '../../data/deck'
import type { CardType } from '../../data/types'
import { t } from '../../i18n/de'
import { textOn } from '../../lib/color'
import { CardImage } from '../CardImage'
import { SdgLabel } from '../SdgChip'

/** "Inhalt & Card-Set" is empty in the concept brochure, so it is generated from cards.json. */
export function CardSetOverview() {
  const l = t.leitfaden
  const perDeck = cardsByArchetype(archetypes[0].id)
  const cases = cards.filter((c) => c.type === 'case').length
  const sdgCount = new Set(archetypes.flatMap((a) => a.sdgs)).size
  // one row per card type; the four cases are shown as one row
  const rows = perDeck.filter((c, i, all) => c.type !== 'case' || all.findIndex((x) => x.type === 'case') === i)

  return (
    <div className="cardset">
      <h4>{l.deckGlance}</h4>
      <p className="cardset__formula">
        {l.deckFormula(cards.length, guideCards().length, archetypes.length, perDeck.length)}
      </p>
      <dl className="numbers" aria-label={l.keyNumbers}>
        {[
          [cards.length, l.numbers.cards],
          [archetypes.length, l.numbers.archetypes],
          [activationCards().length, l.numbers.activation],
          [cases, l.numbers.cases],
          [sdgCount, l.numbers.sdgs],
        ].map(([n, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>

      <h4>{l.anatomyTitle}</h4>
      <p>{l.anatomyLead}</p>
      <ol className="anatomy">
        {rows.map((c, i) => (
          <li key={c.id}>
            <a
              href={`#/karte/${c.id}?liste=${c.archetypeId}`}
              className="anatomy__thumb"
              tabIndex={-1}
              aria-hidden="true"
            >
              <CardImage card={c} decorative />
            </a>
            <span className="anatomy__n" aria-hidden="true">
              {c.type === 'case' ? '5–8' : i + 1}
            </span>
            <span>
              <strong>{c.type === 'case' ? l.caseRange : t.cardTypes[c.type as CardType].one}</strong>
              <span className="anatomy__text">{l.anatomy[c.type as keyof typeof l.anatomy]}</span>
            </span>
          </li>
        ))}
      </ol>

      <h4>{l.archetypesTitle}</h4>
      <ul className="arche-tiles">
        {archetypes.map((a) => (
          <li key={a.id} style={{ borderTopColor: a.colour }}>
            <a
              href={`#/archetyp/${a.id}`}
              className="arche-tiles__head"
              style={{ background: a.colour, color: textOn(a.colour) }}
            >
              <span className="arche-tiles__num">{t.deck.archetype(a.number)}</span>
              <span className="arche-tiles__title">{a.title}</span>
            </a>
            <ul className="sdg-list sdg-list--compact" aria-label={t.archetype.sdgs}>
              {a.sdgs.map((id) => (
                <li key={id} className="sdg-chip">
                  <SdgLabel id={id} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
