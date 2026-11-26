import { t } from '../i18n/de'

export function Legal({ kind }: { kind: 'impressum' | 'datenschutz' }) {
  const l = t.legal
  return (
    <div className="container section legal">
      <h1>{kind === 'impressum' ? l.impressum : l.privacy}</h1>
      <div className="placeholder" role="note">
        <p>
          <strong>{l.todo}</strong>
        </p>
        <p>{l.placeholder}</p>
      </div>
      {kind === 'datenschutz' && (
        <>
          <p>{l.privacyFacts}</p>
          <h2>{l.liveTitle}</h2>
          <ul>
            {l.liveFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
