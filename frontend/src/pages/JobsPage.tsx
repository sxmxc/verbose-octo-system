import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { apiFetch } from '../api'
import { Job, JobLog } from '../types'
import { useToolkits } from '../ToolkitContext'


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

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const refreshButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
}

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  marginTop: '1rem',
}

const filterLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.85rem',
}

const filterSelectStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  marginTop: '1rem',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const tableHeaderRowStyle: React.CSSProperties = {
  textAlign: 'left',
  background: 'var(--color-surface-alt)',
}

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '0.6rem',
}

const jobLabelCellStyle: React.CSSProperties = {
  padding: '0.6rem',
}

const jobRowStyle: React.CSSProperties = {
  borderTop: '1px solid var(--color-border)',
}

const jobOperationStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
}

const jobStatusCellStyle: React.CSSProperties = {
  textTransform: 'capitalize',
}

const jobActionsCellStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
}

const expandedRowStyle: React.CSSProperties = {
  background: 'var(--color-surface-alt)',
  padding: '1rem 1.5rem',
}

const jobDetailsSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
}

const cancelButtonBaseStyle: React.CSSProperties = {
  background: 'var(--color-danger-bg)',
  border: '1px solid var(--color-danger-border)',
  color: 'var(--color-text-primary)',
}

const getCancelButtonStyle = (isCancellable: boolean, isCanceling: boolean): React.CSSProperties => ({
  ...cancelButtonBaseStyle,
  opacity: isCancellable || isCanceling ? 1 : 0.5,
})

const logContainerStyle: React.CSSProperties = {
  fontFamily: 'Source Code Pro, monospace',
  fontSize: '0.85rem',
  background: 'var(--color-surface)',
  borderRadius: 8,
  padding: '0.75rem',
  marginTop: '0.5rem',
  border: '1px solid var(--color-border)',
}

const logTimestampStyle: React.CSSProperties = {
  color: 'var(--color-text-primary)',
}

const errorTextStyle: React.CSSProperties = {
  color: 'var(--color-danger-border)',
}

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'not_found'])


type JobsResponse = {
  jobs: Job[]
}


export default function JobsPage() {
  const { toolkits } = useToolkits()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<Record<string, boolean>>({})
  const selectedToolkit = searchParams.get('toolkit') ?? 'all'
  const hasLoadedRef = useRef(false)

  const load = useCallback(async ({ showSpinner = false }: { showSpinner?: boolean } = {}) => {
    const shouldShowSpinner = showSpinner || !hasLoadedRef.current
    if (shouldShowSpinner) {
      setLoading(true)
    }
    setError(null)
    try {
      const query = selectedToolkit !== 'all' ? `?toolkit=${encodeURIComponent(selectedToolkit)}` : ''
      const response = await apiFetch<JobsResponse>(`/jobs${query}`)
      setJobs(response.jobs)
      hasLoadedRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (shouldShowSpinner) {
        setLoading(false)
      }
    }
  }, [selectedToolkit])

  useEffect(() => {
    load({ showSpinner: true })
    const interval = setInterval(() => load(), 5000)
    return () => clearInterval(interval)
  }, [load])

  const toolkitOptions = useMemo(() => {
    const known = new Map<string, string>()
    toolkits.forEach((toolkit) => known.set(toolkit.slug, toolkit.name))
    jobs.forEach((job) => {
      if (job.toolkit && !known.has(job.toolkit)) {
        known.set(job.toolkit, job.toolkit)
      }
    })
    return Array.from(known.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [toolkits, jobs])

  const hasSelectedToolkitOption =
    selectedToolkit !== 'all' && toolkitOptions.every((option) => option.slug !== selectedToolkit)
  const selectOptions = useMemo(() => {
    if (!hasSelectedToolkitOption) {
      return toolkitOptions
    }
    return [...toolkitOptions, { slug: selectedToolkit, name: selectedToolkit }]
  }, [hasSelectedToolkitOption, selectedToolkit, toolkitOptions])

  const handleToolkitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('toolkit')
    } else {
      next.set('toolkit', value)
    }
    setSearchParams(next, { replace: true })
  }

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
      <div style={headerStyle}>
        <h3 style={{ margin: 0 }}>Job Activity</h3>
        <button onClick={() => load({ showSpinner: true })} style={refreshButtonStyle}>
          Refresh
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={errorTextStyle}>{error}</p>}

      <div style={filterRowStyle}>
        <label style={filterLabelStyle}>
          <span style={{ fontWeight: 600 }}>Toolkit filter</span>
          <select
            value={selectedToolkit}
            onChange={handleToolkitChange}
            style={filterSelectStyle}
          >
            <option value="all">All toolkits</option>
            {selectOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeaderRowStyle}>
              <th style={tableHeaderCellStyle}>Toolkit</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <React.Fragment key={job.id}>
                <tr style={jobRowStyle}>
                  <td style={jobLabelCellStyle}>
                    <strong>{job.toolkit || job.module || 'unknown'}</strong>
                    <div style={jobOperationStyle}>{job.operation}</div>
                  </td>
                  <td style={jobStatusCellStyle}>{job.status}</td>
                  <td>{job.progress}%</td>
                  <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                  <td style={jobActionsCellStyle}>
                    <button onClick={() => toggleExpand(job.id)}>
                      {expandedJobId === job.id ? 'Hide' : 'Inspect'}
                    </button>
                    <button
                      onClick={() => cancelJob(job)}
                      disabled={!canCancel(job) || canceling[job.id]}
                      style={getCancelButtonStyle(canCancel(job), Boolean(canceling[job.id]))}
                    >
                      {canceling[job.id] ? 'Cancelling…' : 'Cancel'}
                    </button>
                  </td>
                </tr>
                {expandedJobId === job.id && (
                  <tr>
                    <td colSpan={5} style={expandedRowStyle}>
                      <section style={jobDetailsSectionStyle}>
                        <JobLogViewer logs={job.logs ?? []} />
                        <div>
                          <strong>Result</strong>
                          <pre style={preStyle}>{JSON.stringify(job.result ?? {}, null, 2)}</pre>
                        </div>
                        {job.error && (
                          <div>
                            <strong style={errorTextStyle}>Error</strong>
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
      <div style={logContainerStyle}>
        {logs.length === 0 ? (
          <div>No log entries.</div>
        ) : (
          logs.map((log) => (
            <div key={log.ts}>
              <span style={logTimestampStyle}>{new Date(log.ts).toLocaleTimeString()}:</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
