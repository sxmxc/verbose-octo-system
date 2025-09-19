import type { CSSProperties } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type { ConnectivitySummary, ProbeEndpoint, ProbePort } from './types'

const React = getReactRuntime()
const { useState } = React

const sectionStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
}

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

export default function AdhocCheckPage() {
  const [input, setInput] = useState('web-1.example.com:80,443\n10.0.0.5:22\n8.8.8.8:53/udp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ConnectivitySummary | null>(null)
  const [repetitions, setRepetitions] = useState(1)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const endpoints = parseInput(input)
      const result = await apiFetch<ConnectivitySummary>('/toolkits/connectivity/actions/adhoc-check', {
        method: 'POST',
        body: JSON.stringify({ endpoints, repetitions }),
      })
      setSummary(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            insights
          </span>
          Ad-hoc connectivity check
        </h4>
        <p style={{ margin: '0.25rem 0 1rem', color: 'var(--color-text-secondary)' }}>
          Paste a host list to quickly validate reachability without saving a probe group.
        </p>
        <label className="tk-label" style={{ display: 'grid', gap: '0.3rem' }}>
          Host list
          <textarea
            className="tk-input"
            rows={6}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="host.example.com:80,443\n10.0.0.5:22\n8.8.8.8:53/udp"
          />
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', width: 120 }}>
            Attempts
            <input
              className="tk-input"
              type="number"
              min={1}
              max={10}
              value={repetitions}
              onChange={(event) => setRepetitions(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
            />
          </label>
          <button type="button" className="tk-button tk-button--primary" onClick={runCheck} disabled={loading}>
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              play_circle
            </span>
            Run check
          </button>
          {loading && <span style={{ color: 'var(--color-text-secondary)' }}>Probing…</span>}
        </div>
        {error && <p style={{ color: 'var(--color-danger-border)', marginTop: '0.75rem' }}>{error}</p>}
      </section>

      {summary && <SummaryCard summary={summary} />}
    </div>
  )
}

function SummaryCard({ summary }: { summary: ConnectivitySummary }) {
  return (
    <section style={sectionStyle}>
      <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
          analytics
        </span>
        Results
      </h4>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {summary.failures === 0
          ? `All ${summary.total_probes} probes succeeded across ${summary.repetitions} attempt${summary.repetitions === 1 ? '' : 's'}.`
          : `${summary.failures} failures detected across ${summary.total_probes} probes in ${summary.repetitions} attempt${summary.repetitions === 1 ? '' : 's'}.`}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: 'var(--color-surface)' }}>
            {summary.repetitions > 1 && <th style={{ padding: '0.4rem' }}>Attempt</th>}
            <th style={{ padding: '0.4rem' }}>Endpoint</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {summary.results.map((result, idx) => (
            <tr key={`${result.host}-${result.port}-${idx}`} style={{ borderTop: '1px solid var(--color-border)' }}>
              {summary.repetitions > 1 && <td>{result.attempt}</td>}
              <td style={{ padding: '0.4rem' }}>
                {result.host}:{result.port}/{result.protocol}
              </td>
              <td style={{ color: result.status === 'reachable' ? 'var(--color-accent)' : 'var(--color-danger-border)' }}>
                {result.status}
              </td>
              <td>{result.latency_ms} ms</td>
              <td>{result.message ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function parseInput(value: string): ProbeEndpoint[] {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error('Provide at least one host entry (format: host:port,port2,port3/udp)')
  }

  return lines.map((line) => {
    const [hostPart, portsPart] = line.split(':')
    if (!portsPart) {
      throw new Error(`Missing ports for host: ${line}`)
    }
    return {
      host: hostPart.trim(),
      ports: parsePorts(portsPart),
    }
  })
}

function parsePorts(token: string): ProbePort[] {
  const entries = token
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (entries.length === 0) {
    return [{ port: 80, protocol: 'tcp' }]
  }

  return entries.map((entry) => {
    const [portPart, protocolPart] = entry.split('/')
    const port = Number.parseInt(portPart, 10)
    if (Number.isNaN(port)) {
      throw new Error(`Invalid port value: ${entry}`)
    }
    const protocol = protocolPart ? protocolPart.toLowerCase() : 'tcp'
    if (protocol !== 'tcp' && protocol !== 'udp') {
      throw new Error(`Unsupported protocol: ${protocol}`)
    }
    return { port, protocol: protocol as 'tcp' | 'udp' }
  })
}
