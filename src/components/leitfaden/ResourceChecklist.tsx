import { useEffect, useState } from 'react'
import type { ListItem } from '../../content/parse'
import { t } from '../../i18n/de'
import { doneCount, loadChecklist, saveChecklist, toggle, type ChecklistState } from '../../lib/checklist'
import { Item } from './Prose'

/** Stable id for an item: its bold label as a slug ("Das Kartenset" → "das-kartenset"). */
const itemId = (it: ListItem, i: number) =>
  (it.label ?? `item-${i}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function ResourceChecklist({ items }: { items: ListItem[] }) {
  const ids = items.map(itemId)
  const [state, setState] = useState<ChecklistState>(() => loadChecklist(ids))
  const l = t.leitfaden

  useEffect(() => {
    saveChecklist(state)
  }, [state])

  return (
    <fieldset className="checklist">
      <legend className="visually-hidden">{l.checklistLabel}</legend>
      <ul>
        {items.map((it, i) => (
          <li key={ids[i]}>
            <label>
              <input type="checkbox" checked={!!state[ids[i]]} onChange={() => setState((s) => toggle(s, ids[i]))} />
              <span>
                <Item item={it} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="checklist__footer">
        <output>{l.checklistProgress(doneCount(state, ids), ids.length)}</output>
        {doneCount(state, ids) > 0 && (
          <button type="button" className="btn btn--ghost btn--small no-print" onClick={() => setState({})}>
            {l.checklistReset}
          </button>
        )}
      </p>
    </fieldset>
  )
}
