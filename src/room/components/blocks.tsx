import { CardImage } from '../../components/CardImage'
import { getArchetype, getCard } from '../../data/deck'
import { t } from '../../i18n/de'
import type { RoomSnapshot } from '../../workshop'
import { groupsOf } from '../derive'
import { archetypeShort, cardLabel, groupSurface } from '../labels'

const r = t.room

/** Archetype front cards, large. */
export function ArchetypeCards({ ids, size = 'md' }: { ids: string[]; size?: 'md' | 'lg' }) {
  return (
    <ul className={`arch-cards arch-cards--${size}`}>
      {ids.map((id) => {
        const card = getCard(`${id}-archetype`)
        const a = getArchetype(id)
        return (
          card &&
          a && (
            <li key={id}>
              <CardImage card={card} size="full" />
              <span className="visually-hidden">{a.title}</span>
            </li>
          )
        )
      })}
    </ul>
  )
}

/** A group's ideas, as cards in the group colour. */
export function Ideas({ snap, groupNo, large }: { snap: RoomSnapshot; groupNo: number; large?: boolean }) {
  const s = groupSurface(snap, groupNo)
  const ideas = snap.ideas.filter((i) => i.groupNo === groupNo)
  return (
    <section
      className={`idea-group${large ? ' idea-group--large' : ''}`}
      style={{ ['--g-bg' as string]: s.bg, ['--g-fg' as string]: s.fg }}
    >
      <h3 className="idea-group__head">
        {r.group(groupNo)}
        {s.archetypeId && <span> · {archetypeShort(s.archetypeId)}</span>}
        <small>{r.console.ideasPerGroup(ideas.length)}</small>
      </h3>
      {ideas.length ? (
        <ul className="idea-group__list">
          {ideas.map((i) => (
            <li key={i.id} className="idea-card">
              <strong>{i.title || r.ideas.untitled}</strong>
              {i.description && <p>{i.description}</p>}
              {(i.inspiredBy || i.target) && (
                <dl>
                  {i.inspiredBy && (
                    <>
                      <dt>{r.ideas.inspiredBy}</dt>
                      <dd>{cardLabel(i.inspiredBy)}</dd>
                    </>
                  )}
                  {i.target && (
                    <>
                      <dt>{r.ideas.target}</dt>
                      <dd>{i.target}</dd>
                    </>
                  )}
                </dl>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{r.projector.noIdeasYet}</p>
      )}
    </section>
  )
}

export function IdeaWall({ snap }: { snap: RoomSnapshot }) {
  return (
    <div className="idea-wall">
      {groupsOf(snap).map((g) => (
        <Ideas key={g} snap={snap} groupNo={g} />
      ))}
    </div>
  )
}

/** Groups with their members (and archetype once drawn). */
export function GroupBoard({ snap, online }: { snap: RoomSnapshot; online?: string[] | null }) {
  const people = snap.members.filter((m) => m.role === 'participant')
  return (
    <div className="group-board">
      {groupsOf(snap).map((g) => {
        const s = groupSurface(snap, g)
        const ms = people.filter((m) => m.groupNo === g)
        return (
          <section
            key={g}
            className="group-board__group"
            style={{ ['--g-bg' as string]: s.bg, ['--g-fg' as string]: s.fg }}
          >
            <h3>
              {r.group(g)}
              {s.archetypeId && <span> · {archetypeShort(s.archetypeId)}</span>}
            </h3>
            {s.archetypeId && <p className="group-board__arch">{getArchetype(s.archetypeId)?.title}</p>}
            <ul>
              {ms.map((m) => (
                <li key={m.id} className={online && !online.includes(m.userId) ? 'is-offline' : undefined}>
                  {m.displayName}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {people.some((m) => !m.groupNo) && (
        <section className="group-board__group group-board__group--none">
          <h3>{r.noGroup}</h3>
          <ul>
            {people
              .filter((m) => !m.groupNo)
              .map((m) => (
                <li key={m.id}>{m.displayName}</li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
