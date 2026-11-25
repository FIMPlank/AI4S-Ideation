import { useCallback, useMemo } from 'react'
import { CardGrid } from '../components/CardGrid'
import { CardStack } from '../components/CardStack'
import { FilterBar } from '../components/FilterBar'
import { archetypes, cardsByArchetype, findCards, GUIDE_COLOUR, GUIDE_DECK_ID, guideCards } from '../data/deck'
import type { CardFilter } from '../data/query'
import { t } from '../i18n/de'
import { filterFromParams, filterToParams, isFiltered } from '../lib/cardList'
import { href, navigate } from '../lib/router'

export function Deck({ params }: { params: URLSearchParams }) {
  const key = params.toString()
  const filter = useMemo(() => filterFromParams(new URLSearchParams(key)), [key])
  const results = useMemo(() => findCards(filter), [filter])
  const active = isFiltered(filter)
  const onChange = useCallback((f: CardFilter) => navigate(href('/karten', filterToParams(f)), { replace: true }), [])
  const d = t.deck

  return (
    <div className="container section">
      <h1>{d.title}</h1>
      <p className="lead">{d.lead}</p>

      <ul className="stack-grid" aria-label={d.decks}>
        {archetypes.map((a, i) => (
          <li key={a.id}>
            <CardStack
              eager={i < 2}
              cards={cardsByArchetype(a.id)}
              to={`#/archetyp/${a.id}`}
              colour={a.colour}
              kicker={d.archetype(a.number)}
              title={a.title}
              subtitle={d.cardsCount(8)}
            />
          </li>
        ))}
        <li>
          <CardStack
            cards={guideCards()}
            to={`#/archetyp/${GUIDE_DECK_ID}`}
            colour={GUIDE_COLOUR}
            title={d.guideDeck}
            subtitle={d.guideCount(guideCards().length)}
          />
        </li>
      </ul>

      <h2>{active ? d.filtered : d.all}</h2>
      <FilterBar filter={filter} onChange={onChange} resultCount={results.length} />
      {active && (
        <p>
          <button type="button" className="btn btn--small" onClick={() => onChange({})}>
            {d.reset}
          </button>
        </p>
      )}
      {results.length > 0 ? (
        <CardGrid
          cards={results}
          listParams={active ? { liste: 'filter', ...filterToParams(filter) } : { liste: 'alle' }}
        />
      ) : (
        <p className="empty">{d.empty}</p>
      )}
    </div>
  )
}
