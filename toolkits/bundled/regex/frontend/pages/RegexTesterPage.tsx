import React, { FormEvent, useState } from 'react'

import { apiFetch } from '../runtime'
import type { RegexTestResponse, RegexMatch } from './types'


const flagOptions = ['IGNORECASE', 'MULTILINE', 'DOTALL', 'VERBOSE', 'UNICODE', 'ASCII']


export default function RegexTesterPage() {
  const [pattern, setPattern] = useState<string>('^host-(?<id>\\d+)$')
  const [testString, setTestString] = useState<string>('host-01\nhost-abc\nhost-22')
  const [flags, setFlags] = useState<string[]>(['MULTILINE'])
  const [result, setResult] = useState<RegexTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const toggleFlag = (flag: string) => {
    setFlags((prev) => (prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]))
  }

  const submit = async (event: FormEvent) => {
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
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <form onSubmit={submit} style={sectionStyle}>
        <h4 style={{ marginTop: 0 }}>Evaluate expression</h4>
        <Field label="Pattern">
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} required />
        </Field>
        <Field label="Test string">
          <textarea value={testString} onChange={(e) => setTestString(e.target.value)} rows={6} required />
        </Field>
        <fieldset style={flagFieldset}>
          <legend>Flags</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {flagOptions.map((flag) => (
              <label key={flag} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
                {flag}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" style={{ width: 'fit-content' }} disabled={loading}>
          {loading ? 'Evaluating…' : 'Evaluate'}
        </button>
      </form>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {result && <RegexResult result={result} />}
    </div>
  )
}


function RegexResult({ result }: { result: RegexTestResponse }) {
  if (!result.ok) {
    return (
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0 }}>Result</h4>
        <p style={{ color: '#dc2626' }}>{result.error}</p>
      </section>
    )
  }

  if (result.matches.length === 0) {
    return (
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0 }}>Result</h4>
        <p>No matches found.</p>
      </section>
    )
  }

  return (
    <section style={sectionStyle}>
      <h4 style={{ marginTop: 0 }}>Matches</h4>
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
        <strong>#{index + 1}</strong> – {match.match} ({match.start}–{match.end})
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


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      {label}
      {children}
    </label>
  )
}


const sectionStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.25rem',
  background: '#f8fafc',
  display: 'grid',
  gap: '0.75rem',
}

const flagFieldset: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '0.75rem',
}

const matchCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  padding: '0.85rem 1rem',
}
