import { useId, useState } from 'react'
import { Tile } from '../components/Tile'
import { t } from '../i18n/de'
import { DEMO_CODE, navigate, roomHref } from '../lib/router'
import { CODE_LENGTH, isValidCode, normalizeCode } from '../workshop'
import { liveRoomsEnabled } from './config'

const h = t.room.home

/** #/raum: open a room or enter a code. */
export function RoomHome() {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const id = useId()
  return (
    <div className="container room-home">
      <header className="page-head">
        <p className="eyebrow">{h.eyebrow}</p>
        <h1>{h.title}</h1>
        <p className="lead">{h.lead}</p>
      </header>
      <div className="room-home__grid">
        <section className="room-panel room-panel--join" aria-labelledby={`${id}-join`}>
          <span className="room-panel__icon" aria-hidden="true">
            <Tile bg="a3" fg="a4" shape="leaf" />
          </span>
          <h2 id={`${id}-join`}>{h.joinTitle}</h2>
          <p>{h.joinText}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const c = normalizeCode(code)
              if (!isValidCode(c)) return setError(true)
              navigate(roomHref(c))
            }}
            noValidate
          >
            <label htmlFor={`${id}-code`}>{h.codeLabel}</label>
            <input
              id={`${id}-code`}
              className="code-input"
              value={code}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CODE_LENGTH + 2}
              aria-describedby={`${id}-hint`}
              aria-invalid={error || undefined}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError(false)
              }}
            />
            <p id={`${id}-hint`} className={error ? 'field__error' : 'muted'}>
              {error ? h.codeInvalid : h.codeHint}
            </p>
            <button type="submit" className="btn btn--primary btn--lg">
              {h.joinCta}
            </button>
          </form>
        </section>
        <section className="room-panel room-panel--create">
          <span className="room-panel__icon" aria-hidden="true">
            <Tile bg="navy" fg="a5" shape="quarter-tl" />
          </span>
          <h2>{h.createTitle}</h2>
          <p>{h.createText}</p>
          {liveRoomsEnabled ? (
            <a className="lbtn lbtn--yellow" href="#/raum/neu">
              {h.createCta}
            </a>
          ) : (
            <p className="tag">{t.room.soon}</p>
          )}
        </section>
        <section className="room-panel room-panel--demo">
          <span className="room-panel__icon" aria-hidden="true">
            <Tile bg="a6" fg="a7" shape="dome" />
          </span>
          <h2>{h.demoTitle}</h2>
          <p>{h.demoText}</p>
          <a className="btn" href={roomHref(DEMO_CODE, 'moderation')}>
            {h.demoCta}
          </a>
        </section>
      </div>
      <p className="muted">
        <a href="#/datenschutz">{h.privacy}</a>
      </p>
    </div>
  )
}
