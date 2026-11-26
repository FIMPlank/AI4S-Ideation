import { t } from '../../i18n/de'
import { isStepEnabled, programRail, type Room, type StepKey } from '../../workshop'

const r = t.room

/** Program → modes → steps; the current step is marked, optional/web steps are labelled. */
export function StepRail({ room, onPick }: { room: Room; onPick?: (key: StepKey) => void }) {
  const rail = programRail(room.program)
  const tag = (source: string, optional: boolean) =>
    optional ? `${r.optional} · ${r.fromLeitfaden}` : source === 'web' ? r.webOnly : null
  const item = (key: StepKey, label: string, note: string | null, disabled = false) => (
    <li
      key={key}
      className={`rail__step${room.stepKey === key ? ' is-current' : ''}${disabled ? ' is-off' : ''}`}
      aria-current={room.stepKey === key ? 'step' : undefined}
    >
      {onPick && !disabled ? (
        <button type="button" onClick={() => onPick(key)}>
          {label}
        </button>
      ) : (
        <span>{label}</span>
      )}
      {note && <small>{note}</small>}
    </li>
  )
  return (
    <nav className="rail" aria-label={r.console.rail}>
      <ol>
        {item('lobby', r.steps.lobby, null)}
        {rail.map((m) => (
          <li key={m.mode} className="rail__mode">
            <span className="rail__mode-name">{r.modes[m.mode]}</span>
            <ol>
              {m.steps.map((s) =>
                item(s.key, r.steps[s.key], tag(s.source, !!s.optional), !isStepEnabled(s, room.settings)),
              )}
            </ol>
          </li>
        ))}
        {item('ende', r.steps.ende, null)}
      </ol>
    </nav>
  )
}
