import type { CSSProperties, FormEvent, ReactNode } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type { RegexTestResponse, RegexMatch } from './types'


const React = getReactRuntime()
const { useState } = React

const flagOptions = ['IGNORECASE', 'MULTILINE', 'DOTALL', 'VERBOSE', 'UNICODE', 'ASCII']

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}


export default function RegexTesterPage() {
  const [pattern, setPattern] = useState<string>('^host-(?P<id>\\d+)$')
  const [testString, setTestString] = useState<string>('host-01\nhost-abc\nhost-22')
  const [flags, setFlags] = useState<string[]>(['MULTILINE'])
  const [result, setResult] = useState<RegexTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const response = await apiFetch<RegexTestResponse>('/toolkits/regex/test', {
        method: 'POST',
        body: JSON.stringify({ pattern, test_string: testString, flags }),
      })
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <form onSubmit={submit} style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            play_circle
          </span>
          Evaluate expression
        </h4>
        <Field label="Pattern">
          <input
            className="tk-input"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            required
          />
        </Field>
        <Field label="Test string">
          <textarea
            className="tk-input"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            rows={6}
            required
          />
        </Field>
        <fieldset className="tk-fieldset">
          <legend className="tk-legend">Flags</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {flagOptions.map((flag) => (
              <label key={flag} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
                {flag}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className="tk-button tk-button--primary"
          style={{ width: 'fit-content' }}
          disabled={loading}
        >
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-text-primary)' }} aria-hidden>
            {loading ? 'hourglass_top' : 'play_arrow'}
          </span>
          {loading ? 'Evaluating…' : 'Evaluate'}
        </button>
      </form>

      {error && (
        <p style={{ color: 'var(--color-danger-border)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-danger-border)' }} aria-hidden>
            error
          </span>
          {error}
        </p>
      )}

      {result && <RegexResult result={result} />}
    </div>
  )
}


function RegexResult({ result }: { result: RegexTestResponse }) {
  if (!result.ok) {
    return (
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-danger-border)' }} aria-hidden>
            report
          </span>
          Result
        </h4>
        <p style={{ color: 'var(--color-danger-border)' }}>{result.error}</p>
      </section>
    )
  }

  if (result.matches.length === 0) {
    return (
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-text-secondary)' }} aria-hidden>
            insights
          </span>
          Result
        </h4>
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-text-muted)' }} aria-hidden>
            visibility_off
          </span>
          No matches found.
        </p>
      </section>
    )
  }

  return (
    <section style={sectionStyle}>
      <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
          check_circle
        </span>
        Matches
      </h4>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {result.matches.map((match, idx) => (
          <MatchCard match={match} index={idx} key={`${match.match}-${idx}`} />
        ))}
      </div>
    </section>
  )
}


function MatchCard({ match, index }: { match: RegexMatch; index: number }) {
  return (
    <div style={matchCardStyle}>
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-link)' }} aria-hidden>
            match_case
          </span>
          <strong>#{index + 1}</strong> – {match.match} ({match.start}–{match.end})
        </span>
      </div>
      {match.groups.length > 0 && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
          <strong>Groups:</strong>{' '}
          {match.groups.map((g, idx) => (
            <span key={idx} style={{ marginRight: '0.5rem' }}>
              #{idx + 1}: {g ?? '∅'}
            </span>
          ))}
        </div>
      )}
      {Object.keys(match.groupdict).length > 0 && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
          <strong>Named groups:</strong>{' '}
          {Object.entries(match.groupdict).map(([key, value]) => (
            <span key={key} style={{ marginRight: '0.5rem' }}>
              {key}: {value ?? '∅'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      {label}
      {children}
    </label>
  )
}


const sectionStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
  display: 'grid',
  gap: '0.75rem',
}

const matchCardStyle: CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  padding: '0.85rem 1rem',
}
