import { useEffect, useId, useState, type CSSProperties } from 'react'
import type { CardFilter } from '../data/query'
import { SDGS } from '../data/sdgs'
import { CARD_TYPES, SDG_IDS } from '../data/types'
import { t } from '../i18n/de'
import { SdgLabel } from './SdgChip'

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function FilterBar(props: { filter: CardFilter; onChange: (f: CardFilter) => void; resultCount: number }) {
  const { filter, onChange, resultCount } = props
  const types = filter.types ?? []
  const sdgs = filter.sdgs ?? []
  const [q, setQ] = useState(filter.query ?? '')
  const searchId = useId()
  const active = types.length + sdgs.length
  // open by default on wide screens or when a filter is set; collapsed on phones to keep results in view
  const [moreOpen, setMoreOpen] = useState(
    () => active > 0 || (typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches),
  )

  // keep the input in sync when the URL changes (back/forward, reset)
  const [synced, setSynced] = useState(filter.query ?? '')
  if ((filter.query ?? '') !== synced) {
    setSynced(filter.query ?? '')
    setQ(filter.query ?? '')
  }

  // write typing into the URL after a short pause
  useEffect(() => {
    if (q === synced) return
    const timer = setTimeout(() => onChange({ ...filter, query: q }), 250)
    return () => clearTimeout(timer)
  }, [q, synced, filter, onChange])

  return (
    <form
      className="filter-bar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onChange({ ...filter, query: q })
      }}
    >
      <div className="filter-bar__search">
        <label htmlFor={searchId}>{t.deck.search}</label>
        <input
          id={searchId}
          type="search"
          value={q}
          placeholder={t.deck.searchPlaceholder}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <details className="filter-bar__more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>
          {t.deck.moreFilters}
          {active > 0 && <span className="badge">{t.deck.activeFilters(active)}</span>}
        </summary>
        <div className="filter-bar__more-body">
          <fieldset>
            <legend>{t.deck.typeLegend}</legend>
            <div className="chips">
              {CARD_TYPES.map((type) => (
                <label key={type} className="chip-toggle">
                  <input
                    type="checkbox"
                    checked={types.includes(type)}
                    onChange={() => onChange({ ...filter, types: toggle(types, type) })}
                  />
                  <span>{t.cardTypes[type].many}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t.deck.sdgLegend}</legend>
            <div className="chips">
              {SDG_IDS.map((id) => (
                <label
                  key={id}
                  className="chip-toggle chip-toggle--sdg"
                  style={{ '--sdg': SDGS[id].color } as CSSProperties}
                >
                  <input
                    type="checkbox"
                    checked={sdgs.includes(id)}
                    onChange={() => onChange({ ...filter, sdgs: toggle(sdgs, id) })}
                  />
                  <SdgLabel id={id} />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
      <output className="filter-bar__count">{t.deck.results(resultCount)}</output>
    </form>
  )
}
