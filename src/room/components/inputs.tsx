import { useEffect, useId, useRef, useState } from 'react'
import { getCard } from '../../data/deck'
import { t } from '../../i18n/de'
import { displayTitle } from '../../lib/cardInfo'
import {
  CRITERIA,
  LIMITS,
  type Criterion,
  type Idea,
  type ImplStep,
  type Me,
  type Note,
  type RoomSnapshot,
  type StepKey,
} from '../../workshop'
import type { WorkshopStore } from '../../workshop/store/types'
import { fire } from '../hooks'

const r = t.room

/**
 * A text field that saves 800 ms after the last keystroke and on blur.
 * Remote changes don't overwrite the field while it has focus.
 */
export function SyncedField({
  label,
  value,
  max,
  multiline,
  placeholder,
  disabled,
  onSave,
  hint,
}: {
  label: string
  value: string
  max: number
  multiline?: boolean
  placeholder?: string
  disabled?: boolean
  onSave: (v: string) => Promise<unknown>
  hint?: string
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const last = useRef(value)

  useEffect(() => {
    if (!focused.current) setDraft(value)
    last.current = value
  }, [value])

  const save = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (v.trim() === last.current.trim()) return
    setState('saving')
    onSave(v).then(
      () => setState('saved'),
      () => {
        // rollback to the server value
        setState('idle')
        setDraft(last.current)
      },
    )
  }

  const props = {
    id,
    value: draft,
    maxLength: max,
    placeholder,
    disabled,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false
      save(draft)
    },
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value
      setDraft(v)
      setState('idle')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => save(v), 800)
    },
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}
      <span className="field__meta" aria-live="polite">
        {hint && <span>{hint}</span>}
        <span>{state === 'saving' ? r.saving : state === 'saved' ? r.saved : ''}</span>
        {draft.length > max * 0.8 && (
          <span>
            {draft.length}/{max}
          </span>
        )}
      </span>
    </div>
  )
}

export function IdeaEditor({
  store,
  idea,
  cases,
  canEdit,
}: {
  store: WorkshopStore
  idea: Idea
  cases: string[]
  canEdit: boolean
}) {
  const i = r.ideas
  const sid = useId()
  const save = (patch: Partial<Idea>) => store.saveIdea({ id: idea.id, groupNo: idea.groupNo, ...patch })
  return (
    <article className="idea-editor">
      <SyncedField
        label={i.title}
        value={idea.title}
        max={LIMITS.ideaTitle}
        disabled={!canEdit}
        onSave={(v) => save({ title: v })}
      />
      <SyncedField
        label={i.description}
        value={idea.description}
        max={LIMITS.ideaDescription}
        multiline
        disabled={!canEdit}
        onSave={(v) => save({ description: v })}
      />
      <div className="field">
        <label htmlFor={sid}>{i.inspiredBy}</label>
        <select
          id={sid}
          value={idea.inspiredBy ?? ''}
          disabled={!canEdit}
          onChange={(e) => fire(save({ inspiredBy: e.target.value || null }))}
        >
          <option value="">{i.inspiredByNone}</option>
          {cases.map((c) => (
            <option key={c} value={c}>
              {displayTitle(getCard(c)!)}
            </option>
          ))}
        </select>
      </div>
      <SyncedField
        label={i.target}
        value={idea.target}
        max={LIMITS.ideaTarget}
        disabled={!canEdit}
        onSave={(v) => save({ target: v })}
      />
      {canEdit && (
        <button type="button" className="btn btn--small btn--ghost" onClick={() => fire(store.deleteIdea(idea.id))}>
          {i.delete}
        </button>
      )}
    </article>
  )
}

export function NotesPanel({
  store,
  snap,
  me,
  stepKey,
  topic,
  selectionId = null,
  title,
  readOnly,
}: {
  store: WorkshopStore
  snap: RoomSnapshot
  me: Me
  stepKey: StepKey
  topic: string
  selectionId?: string | null
  title: string
  readOnly?: boolean
}) {
  const [body, setBody] = useState('')
  const id = useId()
  const notes = snap.notes.filter(
    (n) => n.stepKey === stepKey && n.topic === topic && (n.selectionId ?? null) === selectionId,
  )
  const p = r.participant
  return (
    <section className="notes">
      <h3>{title}</h3>
      {notes.length ? (
        <ul className="notes__list">
          {notes.map((n: Note) => (
            <li key={n.id} className={n.byFacilitator ? 'is-facilitator' : undefined}>
              <span>{n.body}</span>
              {!readOnly && (n.authorId === me.userId || me.role === 'facilitator') && (
                <button
                  type="button"
                  className="notes__delete"
                  aria-label={p.deleteNote}
                  onClick={() => fire(store.deleteNote(n.id))}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{p.noNotes}</p>
      )}
      {!readOnly && (
        <form
          className="notes__form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!body.trim()) return
            store.addNote({ stepKey, topic, selectionId, body }).then(
              () => setBody(''),
              () => undefined,
            )
          }}
        >
          <label htmlFor={id} className="visually-hidden">
            {title}
          </label>
          <input
            id={id}
            type="text"
            value={body}
            maxLength={LIMITS.note}
            placeholder={p.notePlaceholder}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--small" disabled={!body.trim()}>
            {p.addNote}
          </button>
        </form>
      )}
    </section>
  )
}

/** 1–5 as a radio group per criterion. */
export function RatingInput({
  value,
  onChange,
  disabled,
  name,
}: {
  value: Partial<Record<Criterion, number>>
  onChange: (c: Criterion, v: number) => void
  disabled?: boolean
  name: string
}) {
  return (
    <div className="rating">
      {CRITERIA.map((c) => (
        <fieldset key={c} className="rating__row" disabled={disabled}>
          <legend>{r.criteria[c]}</legend>
          <div className="rating__scale">
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} className={value[c] === v ? 'is-on' : undefined}>
                <input
                  type="radio"
                  name={`${name}-${c}`}
                  value={v}
                  checked={value[c] === v}
                  onChange={() => onChange(c, v)}
                />
                <span aria-hidden="true">{v}</span>
                <span className="visually-hidden">
                  {v} – {r.scale(v)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export function ImplStepsEditor({
  store,
  snap,
  me,
  selectionId,
  readOnly,
}: {
  store: WorkshopStore
  snap: RoomSnapshot
  me: Me
  selectionId: string
  readOnly?: boolean
}) {
  const im = r.impl
  const steps = snap.implSteps.filter((s) => s.selectionId === selectionId).sort((a, b) => a.position - b.position)
  const canEdit = (s: ImplStep) => !readOnly && (s.createdBy === me.userId || me.role === 'facilitator')
  return (
    <div className="impl">
      {steps.length === 0 && <p className="muted">{im.none}</p>}
      {steps.map((s) => (
        <div key={s.id} className="impl__row">
          <SyncedField
            label={im.what}
            value={s.what}
            max={LIMITS.implWhat}
            disabled={!canEdit(s)}
            onSave={(v) => store.saveImplStep({ id: s.id, selectionId, what: v })}
          />
          <SyncedField
            label={im.who}
            value={s.who}
            max={LIMITS.implWho}
            placeholder={im.whoPlaceholder}
            disabled={!canEdit(s)}
            onSave={(v) => store.saveImplStep({ id: s.id, selectionId, who: v })}
          />
          <DueField
            value={s.due}
            disabled={!canEdit(s)}
            onSave={(v) => fire(store.saveImplStep({ id: s.id, selectionId, due: v }))}
          />
          {canEdit(s) && (
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => fire(store.deleteImplStep(s.id))}
            >
              {im.delete}
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="btn" onClick={() => fire(store.saveImplStep({ selectionId, what: '' }))}>
          {im.add}
        </button>
      )}
    </div>
  )
}

function DueField({
  value,
  onSave,
  disabled,
}: {
  value: string | null
  onSave: (v: string | null) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{r.impl.due}</label>
      <input
        id={id}
        type="date"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onSave(e.target.value || null)}
      />
    </div>
  )
}
