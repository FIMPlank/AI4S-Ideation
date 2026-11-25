import type { ListItem } from '../../content/parse'
import { BenefitIcon } from './BenefitIcon'
import { Html } from './Prose'

/** The four Kernvorteile as tiles: icon, bold label, text. */
export function Benefits({ items, headingLevel = 3 }: { items: ListItem[]; headingLevel?: 3 | 4 | 5 }) {
  const H = `h${headingLevel}` as 'h3' | 'h4' | 'h5'
  return (
    <ul className="benefits">
      {items.map((it, i) => (
        <li key={i} className="benefit">
          <BenefitIcon index={i} />
          <H className="benefit__label">{it.label}</H>
          <Html as="p" html={it.html} />
        </li>
      ))}
    </ul>
  )
}
