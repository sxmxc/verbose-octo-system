import type { CSSProperties } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type { ConnectivitySummary, Job } from './types'
import { useConnectivityTargets } from './hooks'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
}

type JobsResponse = {
  jobs: Job[]
}

type PreviewState = {
  loading: boolean
  error: string | null
  summary: ConnectivitySummary | null
}

export default function ConnectivityOverviewPage() {
  const { targets, selectedId, setSelectedId, selectedTarget, loading, error, refresh } = useConnectivityTargets()
  const [jobs, setJobs] = useState<Job[]>([])
  const [preview, setPreview] = useState<PreviewState>({ loading: false, error: null, summary: null })
  const [repetitions, setRepetitions] = useState(1)
  const [jobFeedback, setJobFeedback] = useState<string | null>(null)
  const [queueBusy, setQueueBusy] = useState(false)

  useEffect(() => {
    apiFetch<JobsResponse>('/jobs?toolkit=connectivity')
      .then((response) => setJobs(response.jobs.slice(0, 5)))
      .catch((err) => {
        console.error(err)
      })
  }, [])

  const totals = useMemo(() => {
    const endpointCount = targets.reduce((sum, target) => sum + target.endpoint_count, 0)
    return {
      groups: targets.length,
      endpoints: endpointCount,
    }
  }, [targets])

  const runPreview = async () => {
    if (!selectedTarget) {
      return
    }
    setPreview({ loading: true, error: null, summary: null })
    try {
      const summary = await apiFetch<ConnectivitySummary>(
        `/toolkits/connectivity/targets/${selectedTarget.id}/actions/check/preview`,
        {
          method: 'POST',
          body: JSON.stringify({ repetitions }),
        },
      )
      setPreview({ loading: false, error: null, summary })
    } catch (err) {
      setPreview({ loading: false, error: err instanceof Error ? err.message : String(err), summary: null })
    }
  }

  const queueJob = async () => {
    if (!selectedTarget) {
      return
    }
    setQueueBusy(true)
    setJobFeedback(null)
    try {
      await apiFetch(`/toolkits/connectivity/targets/${selectedTarget.id}/actions/check/execute`, {
        method: 'POST',
        body: JSON.stringify({ repetitions }),
      })
      setJobFeedback(`Queued connectivity job for "${selectedTarget.name}" (${repetitions} attempt${repetitions === 1 ? '' : 's'}).`)
      const response = await apiFetch<JobsResponse>('/jobs?toolkit=connectivity')
      setJobs(response.jobs.slice(0, 5))
    } catch (err) {
      setJobFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setQueueBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <section style={sectionStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                radar
              </span>
              Connectivity summary
            </h4>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
              Track configured probe groups and recent reachability jobs.
            </p>
          </div>
          <button
            type="button"
            className="tk-button"
            onClick={() => {
              refresh()
              apiFetch<JobsResponse>('/jobs?toolkit=connectivity')
                .then((response) => setJobs(response.jobs.slice(0, 5)))
                .catch((err) => console.error(err))
            }}
          >
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              refresh
            </span>
            Refresh
          </button>
        </header>

        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading targets…</p>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <MetricCard label="Probe groups" value={totals.groups} />
            <MetricCard label="Endpoints" value={totals.endpoints} />
          </div>
        )}
        {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}
      </section>

      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            network_check
          </span>
          Quick preview
        </h4>
        {targets.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Create a probe group in the Targets tab to run a preview.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', maxWidth: 320 }}>
              Probe group
              <select className="tk-input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', maxWidth: 160 }}>
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
            <button type="button" className="tk-button tk-button--primary" onClick={runPreview} disabled={preview.loading}>
              <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                play_circle
              </span>
              Run preview
            </button>
            <button type="button" className="tk-button" onClick={queueJob} disabled={queueBusy}>
              <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                bolt
              </span>
              Queue job
            </button>
            {preview.loading && <p style={{ color: 'var(--color-text-secondary)' }}>Running probes…</p>}
            {preview.error && <p style={{ color: 'var(--color-danger-border)' }}>{preview.error}</p>}
            {preview.summary && <PreviewTable summary={preview.summary} />}
            {jobFeedback && <p style={{ color: 'var(--color-text-secondary)' }}>{jobFeedback}</p>}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            schedule
          </span>
          Recent jobs
        </h4>
        {jobs.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No recent connectivity jobs.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--color-surface-alt)' }}>
                <th style={{ padding: '0.5rem' }}>Operation</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{job.operation}</td>
                  <td style={{ textTransform: 'capitalize' }}>{job.status}</td>
                  <td>{job.progress}%</td>
                  <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '0.85rem 1.1rem',
        background: 'var(--color-surface)',
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function PreviewTable({ summary }: { summary: ConnectivitySummary }) {
  const { useMemo } = React
  const condensed = useMemo(() => summary.results.slice(0, 10), [summary.results])
  const showAttempt = summary.repetitions > 1

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
        {summary.failures === 0
          ? 'All probes succeeded.'
          : `${summary.failures} of ${summary.total_probes} probes reported failures.`}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: 'var(--color-surface)' }}>
            {showAttempt && <th style={{ padding: '0.4rem' }}>Attempt</th>}
            <th style={{ padding: '0.4rem' }}>Endpoint</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {condensed.map((result, idx) => (
            <tr key={`${result.host}-${result.port}-${idx}`} style={{ borderTop: '1px solid var(--color-border)' }}>
              {showAttempt && <td>{result.attempt}</td>}
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
      {summary.results.length > 10 && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Showing first 10 results out of {summary.total_probes} probes.
        </p>
      )}
    </div>
  )
}
