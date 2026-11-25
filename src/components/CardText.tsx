import type { Card } from '../data/types'
import { t } from '../i18n/de'

type H = 'h2' | 'h3' | 'h4'

const List = ({ items }: { items: string[] }) => (
  <ul>
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
)

/** The back of a card as semantic HTML, built from cards.json. */
export function CardText({ card, level = 3 }: { card: Card; level?: 2 | 3 | 4 }) {
  const Heading = `h${level}` as H
  const c = t.card
  switch (card.type) {
    case 'guide':
      return (
        <div className="card-text">
          <Heading>{c.guideSteps}</Heading>
          <ol>
            {card.steps.map((s, i) => (
              <li key={i}>
                {s.text}
                {s.subItems.length > 0 && <List items={s.subItems} />}
              </li>
            ))}
          </ol>
          <dl>
            <dt>{c.what}</dt>
            <dd>{card.what}</dd>
            <dt>{c.when}</dt>
            <dd>{card.when}</dd>
          </dl>
        </div>
      )
    case 'archetype':
      return (
        <div className="card-text">
          <p>{card.intro}</p>
          {card.points.length > 0 && (
            <ol>
              {card.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
          <Heading>{c.sustainabilityLink}</Heading>
          <p>{card.sustainabilityLink}</p>
        </div>
      )
    case 'technology':
    case 'organisation':
      return (
        <div className="card-text">
          <List items={card.points} />
          <Heading>{card.type === 'technology' ? c.tip : c.valueProposition}</Heading>
          <p>{card.type === 'technology' ? card.tip : card.valueProposition}</p>
        </div>
      )
    case 'activation':
      return (
        <div className="card-text">
          <p className="card-text__question">{card.question}</p>
          <Heading>{c.caseOverview}</Heading>
          <List items={card.caseOverview} />
        </div>
      )
    case 'case':
      return (
        <div className="card-text">
          <p>{card.summary}</p>
          <Heading>{c.takeaways}</Heading>
          <dl>
            <dt>{c.takeawayTechnology}</dt>
            <dd>{card.takeaways.technology}</dd>
            <dt>{c.takeawayOrganisation}</dt>
            <dd>{card.takeaways.organisation}</dd>
            <dt>{c.takeawaySustainability}</dt>
            <dd>{card.takeaways.sustainability}</dd>
          </dl>
        </div>
      )
  }
}
