import React, { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../api'
import { Job, JobLog } from '../types'


const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 12,
  boxShadow: 'var(--color-shadow)',
  border: '1px solid var(--color-border)',
  padding: '1.5rem',
  color: 'var(--color-text-primary)',
}

const preStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontFamily: 'Source Code Pro, monospace',
  marginTop: '0.4rem',
  overflowX: 'auto',
  border: '1px solid var(--color-border)',
}

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'not_found'])


type JobsResponse = {
  jobs: Job[]
}


export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<JobsResponse>('/jobs')
      setJobs(response.jobs)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const toggleExpand = (id: string) => {
    setExpandedJobId((current) => (current === id ? null : id))
  }

  const canCancel = (job: Job) => !TERMINAL_STATUSES.has(job.status) && job.status !== 'cancelling'

  const cancelJob = async (job: Job) => {
    if (!canCancel(job)) return
    setCanceling((prev) => ({ ...prev, [job.id]: true }))
    try {
      await apiFetch<{ job: Job }>(`/jobs/${job.id}/cancel`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCanceling((prev) => ({ ...prev, [job.id]: false }))
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Job Activity</h3>
        <button onClick={load} style={{ padding: '0.4rem 0.9rem' }}>
          Refresh
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}

      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--color-surface-alt)' }}>
              <th style={{ padding: '0.6rem' }}>Toolkit</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <React.Fragment key={job.id}>
                <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.6rem' }}>
                    <strong>{job.toolkit || job.module || 'unknown'}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{job.operation}</div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{job.status}</td>
                  <td>{job.progress}%</td>
                  <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide' : 'Inspect'}
                    </button>
                    <button
                      onClick={() => cancelJob(job)}
                      disabled={!canCancel(job) || canceling[job.id]}
                      style={{
                        background: 'var(--color-danger-bg)',
                        border: '1px solid var(--color-danger-border)',
                        opacity: !canCancel(job) && !canceling[job.id] ? 0.5 : 1,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {canceling[job.id] ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </td>
                </tr>
                {expandedJobId === job.id && (
                  <tr>
                    <td colSpan={5} style={{ background: 'var(--color-surface-alt)', padding: '1rem 1.5rem' }}>
                      <section style={{ display: 'grid', gap: '0.75rem' }}>
                        <JobLogViewer logs={job.logs ?? []} />
                        <div>
                          <strong>Result</strong>
                          <pre style={preStyle}>{JSON.stringify(job.result ?? {}, null, 2)}</pre>
                        </div>
                        {job.error && (
                          <div>
                            <strong style={{ color: 'var(--color-danger-border)' }}>Error</strong>
                            <pre style={preStyle}>{job.error}</pre>
                          </div>
                        )}
                      </section>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function JobLogViewer({ logs }: { logs: JobLog[] }) {
  return (
    <div>
      <strong>Logs</strong>
      <div
        style={{
          fontFamily: 'Source Code Pro, monospace',
          fontSize: '0.85rem',
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: '0.75rem',
          marginTop: '0.5rem',
          border: '1px solid var(--color-border)',
        }}
      >
        {logs.length === 0 ? (
          <div>No log entries.</div>
        ) : (
          logs.map((log) => (
            <div key={log.ts}>
              <span style={{ color: 'var(--color-text-primary)' }}>{new Date(log.ts).toLocaleTimeString()}:</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
