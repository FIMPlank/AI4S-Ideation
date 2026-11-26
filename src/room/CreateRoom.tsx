import { useId, useState } from 'react'
import { Item } from '../components/leitfaden/Prose'
import { ResourceChecklist } from '../components/leitfaden/ResourceChecklist'
import { MODES } from '../config/modes'
import { firstList, sectionById } from '../content/leitfaden'
import { t } from '../i18n/de'
import { absoluteUrl, href, roomHref } from '../lib/router'
import {
  DEFAULT_SETTINGS,
  LIMITS,
  normalizeSettings,
  WorkshopError,
  type ProgramId,
  type RoomSettings,
} from '../workshop'
import type { CreatedRoom } from '../workshop/store/types'
import { liveBackend } from './backend'
import { liveRoomsEnabled } from './config'
import { errorText } from './labels'
import { CopyButton, RoomCode } from './components/basics'

const c = t.room.create
const PRESET_CHOICES = [3, 5, 10, 15, 20, 30]

export function CreateRoom() {
  const id = useId()
  const [title, setTitle] = useState('')
  const [program, setProgram] = useState<ProgramId>('komplett')
  const [s, setS] = useState<RoomSettings>(DEFAULT_SETTINGS)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<boolean | 'sign-in-disabled'>(false)
  const [done, setDone] = useState<CreatedRoom | null>(null)
  const set = (patch: Partial<RoomSettings>) => setS((x) => normalizeSettings({ ...x, ...patch }))
  const usesI1 = program === 'komplett' || program === 'inspiration-1'
  const usesI2 = program === 'komplett' || program === 'inspiration-2'

  if (!liveRoomsEnabled)
    return (
      <div className="container room-home">
        <h1>{c.title}</h1>
        <p className="lead">{t.room.soon}</p>
        <p>{t.room.soonText}</p>
        <a className="btn btn--primary" href={roomHref('demo', 'moderation')}>
          {t.room.home.demoCta}
        </a>
      </div>
    )

  if (done) {
    const modLink = `${absoluteUrl(roomHref(done.code, 'moderation'))}?schluessel=${encodeURIComponent(done.facilitatorSecret)}`
    return (
      <div className="container room-home">
        <h1>{c.doneTitle}</h1>
        <p className="eyebrow">{c.code}</p>
        <RoomCode code={done.code} size="lg" />
        <section className="room-panel modlink">
          <h2>{c.modLink}</h2>
          <p>{c.modLinkHint}</p>
          <p className="modlink__url">
            <code>{modLink}</code>
          </p>
          <CopyButton text={modLink} label={c.copy} />
        </section>
        <a className="btn btn--primary btn--lg" href={roomHref(done.code, 'moderation')}>
          {c.toConsole} →
        </a>
      </div>
    )
  }

  const ressourcen = sectionById('ressourcen')
  const prepStep = firstList(sectionById('allgemeine-vorbereitung'))[0]
  return (
    <div className="container room-create">
      <h1>{c.title}</h1>
      <form
        className="room-create__form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setFailed(false)
          try {
            const backend = await liveBackend()
            if (!backend) throw new Error('no backend')
            setDone(await backend.createRoom({ title, program, settings: s }))
          } catch (err) {
            setFailed(err instanceof WorkshopError && err.reason === 'sign-in-disabled' ? err.reason : true)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-title`}>{c.roomTitle}</label>
          <input
            id={`${id}-title`}
            value={title}
            maxLength={LIMITS.roomTitle}
            placeholder={c.roomTitlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <fieldset className="program-pick">
          <legend>{c.program}</legend>
          {[
            ...MODES.map((m) => ({ id: m.id as ProgramId, name: m.name, hint: '' })),
            { id: 'komplett' as ProgramId, name: c.full, hint: c.fullHint },
          ].map((o) => (
            <label key={o.id} className={program === o.id ? 'is-on' : undefined}>
              <input
                type="radio"
                name="program"
                value={o.id}
                checked={program === o.id}
                onChange={() => setProgram(o.id)}
              />
              <span>
                <strong>{o.name}</strong>
                {o.hint && <small>{o.hint}</small>}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="settings">
          <legend>{c.settings}</legend>
          {usesI1 && (
            <div className="field">
              <label htmlFor={`${id}-groups`}>{c.groups}</label>
              <input
                id={`${id}-groups`}
                type="number"
                min={1}
                max={LIMITS.maxGroups}
                value={s.groupCount}
                onChange={(e) => set({ groupCount: Number(e.target.value) })}
              />
              <span className="field__meta">{c.groupsHint}</span>
            </div>
          )}
          {usesI2 && (
            <div className="field">
              <label htmlFor={`${id}-dots`}>{c.dots}</label>
              <input
                id={`${id}-dots`}
                type="number"
                min={LIMITS.minDots}
                max={LIMITS.maxDots}
                value={s.dotsPerPerson}
                onChange={(e) => set({ dotsPerPerson: Number(e.target.value) })}
              />
              <span className="field__meta">{c.dotsHint}</span>
            </div>
          )}
          <fieldset className="chips">
            <legend>{c.presets}</legend>
            {PRESET_CHOICES.map((m) => (
              <label key={m} className="chip-toggle">
                <input
                  type="checkbox"
                  checked={s.timerPresetsMin.includes(m)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...s.timerPresetsMin, m] : s.timerPresetsMin.filter((x) => x !== m)
                    if (next.length) set({ timerPresetsMin: next })
                  }}
                />
                <span>{m}</span>
              </label>
            ))}
          </fieldset>
          {usesI1 && (
            <>
              <OptionalStep
                label={c.klaerung}
                enabled={s.klaerung.enabled}
                minutes={s.klaerung.minutes}
                minutesLabel={c.minutes}
                max={60}
                onChange={(enabled, minutes) => set({ klaerung: { enabled, minutes } })}
              />
              <OptionalStep
                label={c.pitch}
                enabled={s.pitch.enabled}
                minutes={s.pitch.minutesPerGroup}
                minutesLabel={c.minutesPerGroup}
                max={15}
                onChange={(enabled, minutesPerGroup) => set({ pitch: { enabled, minutesPerGroup } })}
              />
            </>
          )}
        </fieldset>

        <section className="prep" aria-labelledby={`${id}-prep`}>
          <h2 id={`${id}-prep`}>{c.prep}</h2>
          <p className="muted">{c.prepIntro}</p>
          {prepStep && (
            <p className="prep__step">
              <Item item={prepStep} /> <a href={href('/leitfaden/allgemeine-vorbereitung')}>{t.site.navGuide}</a>
            </p>
          )}
          {ressourcen && <ResourceChecklist items={firstList(ressourcen)} />}
        </section>

        {failed && (
          <p className="field__error" role="alert">
            {failed === true ? c.failed : errorText(failed)}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? c.creating : c.submit}
        </button>
      </form>
    </div>
  )
}

function OptionalStep({
  label,
  enabled,
  minutes,
  minutesLabel,
  max,
  onChange,
}: {
  label: string
  enabled: boolean
  minutes: number
  minutesLabel: string
  max: number
  onChange: (enabled: boolean, minutes: number) => void
}) {
  const id = useId()
  return (
    <div className="optional-step">
      <label className="switch">
        <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked, minutes)} />
        <span>
          {label}
          <small>{c.optionalHint}</small>
        </span>
      </label>
      {enabled && (
        <span className="field field--inline">
          <label htmlFor={id}>{minutesLabel}</label>
          <input
            id={id}
            type="number"
            min={1}
            max={max}
            value={minutes}
            onChange={(e) => onChange(true, Number(e.target.value))}
          />
        </span>
      )}
    </div>
  )
}
