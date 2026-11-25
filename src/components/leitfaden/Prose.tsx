import type { Block, ListItem } from '../../content/parse'

/**
 * Renders brochure blocks. The HTML comes from our own build-time Markdown
 * parser (raw HTML disabled, so it only contains escaped text, <strong>, <em> and <a>).
 */
export function Html({ html, as: Tag = 'span' }: { html: string; as?: 'span' | 'p' | 'li' | 'div' }) {
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />
}

export function Item({ item }: { item: ListItem }) {
  return (
    <>
      {item.label && <strong>{item.label}: </strong>}
      <Html html={item.html} />
    </>
  )
}

export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'p') return <Html key={i} as="p" html={b.html} />
        const items = b.items.map((it, j) => (
          <li key={j}>
            <Item item={it} />
          </li>
        ))
        return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>
      })}
    </>
  )
}
