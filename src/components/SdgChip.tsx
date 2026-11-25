import { SDGS } from '../data/sdgs'
import type { SdgId } from '../data/types'
import { t } from '../i18n/de'
import { textOn } from '../lib/color'

export function SdgBadge({ id }: { id: SdgId }) {
  const { color } = SDGS[id]
  return (
    <span className="sdg-badge" style={{ background: color, color: textOn(color) }} aria-hidden="true">
      {id}
    </span>
  )
}

export function SdgLabel({ id }: { id: SdgId }) {
  return (
    <>
      <SdgBadge id={id} />
      <span>
        <span className="visually-hidden">{t.sdg(id)}</span>
        {SDGS[id].title}
      </span>
    </>
  )
}

export function SdgList({ ids, label }: { ids: SdgId[]; label: string }) {
  if (ids.length === 0) return null
  return (
    <ul className="sdg-list" aria-label={label}>
      {ids.map((id) => (
        <li key={id} className="sdg-chip" style={{ borderColor: SDGS[id].color }}>
          <SdgLabel id={id} />
        </li>
      ))}
    </ul>
  )
}
