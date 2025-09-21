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
  flexWrap: 'wrap',
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
  fontWeight: 600,
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

const paginationContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '1.25rem',
  gap: '0.75rem',
  flexWrap: 'wrap',
}

const paginationInfoStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
}

const paginationButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.8rem',
  fontSize: '0.85rem',
}

const emptyStateStyle: React.CSSProperties = {
  marginTop: '1.25rem',
  fontSize: '0.9rem',
  color: 'var(--color-text-secondary)',
}

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'not_found'])


type JobsResponse = {
  jobs: Job[]
  total: number
  page: number
  page_size: number
}


const JOB_STATUS_OPTIONS = ['queued', 'running', 'cancelling', 'cancelled', 'succeeded', 'failed', 'not_found'] as const

const PAGE_SIZE = 10

function formatStatusLabel(status: string): string {
  if (!status) {
    return 'Unknown'
  }
  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
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
  const selectedStatus = searchParams.get('status') ?? 'all'
  const currentPageParam = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const currentPage = Number.isFinite(currentPageParam) && currentPageParam > 0 ? currentPageParam : 1
  const [totalJobs, setTotalJobs] = useState<number>(0)
  const hasLoadedRef = useRef(false)

  const load = useCallback(
    async ({ showSpinner = false }: { showSpinner?: boolean } = {}) => {
      const shouldShowSpinner = showSpinner || !hasLoadedRef.current
      if (shouldShowSpinner) {
        setLoading(true)
      }
      setError(null)
      try {
        const query = new URLSearchParams()
        if (selectedToolkit !== 'all') {
          query.append('toolkit', selectedToolkit)
        }
        if (selectedStatus !== 'all') {
          query.append('status', selectedStatus)
        }
        query.set('page', String(currentPage))
        query.set('page_size', String(PAGE_SIZE))
        const qs = query.toString()
        const endpoint = qs ? `/jobs?${qs}` : '/jobs'
        const response = await apiFetch<JobsResponse>(endpoint)
        setJobs(response.jobs)
        setTotalJobs(response.total ?? response.jobs.length)
        hasLoadedRef.current = true
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (shouldShowSpinner) {
          setLoading(false)
        }
      }
    },
    [selectedToolkit, selectedStatus, currentPage]
  )

  useEffect(() => {
    load({ showSpinner: true })
    const interval = setInterval(() => load(), 5000)
    return () => clearInterval(interval)
  }, [load])

  const toolkitNameLookup = useMemo(() => {
    const lookup = new Map<string, string>()
    toolkits.forEach((toolkit) => lookup.set(toolkit.slug, toolkit.name))
    return lookup
  }, [toolkits])

  const toolkitOptions = useMemo(() => {
    const known = new Map(toolkitNameLookup)
    jobs.forEach((job) => {
      if (job.toolkit && !known.has(job.toolkit)) {
        known.set(job.toolkit, job.toolkit)
      }
    })
    return Array.from(known.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [jobs, toolkitNameLookup])

  const hasSelectedToolkitOption =
    selectedToolkit !== 'all' && toolkitOptions.every((option) => option.slug !== selectedToolkit)
  const selectOptions = useMemo(() => {
    if (!hasSelectedToolkitOption) {
      return toolkitOptions
    }
    return [...toolkitOptions, { slug: selectedToolkit, name: selectedToolkit }]
  }, [hasSelectedToolkitOption, selectedToolkit, toolkitOptions])

  const statusOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: string[] = []
    JOB_STATUS_OPTIONS.forEach((status) => {
      seen.add(status)
      options.push(status)
    })
    jobs.forEach((job) => {
      const status = job.status
      if (status && !seen.has(status)) {
        seen.add(status)
        options.push(status)
      }
    })
    if (selectedStatus !== 'all' && !seen.has(selectedStatus)) {
      options.push(selectedStatus)
    }
    return options
  }, [jobs, selectedStatus])

  const handleToolkitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('toolkit')
    } else {
      next.set('toolkit', value)
    }
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('status')
    } else {
      next.set('status', value)
    }
    next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE))
      const target = Math.min(Math.max(nextPage, 1), totalPages)
      if (target === currentPage) {
        return
      }
      const next = new URLSearchParams(searchParams)
      if (target <= 1) {
        next.delete('page')
      } else {
        next.set('page', String(target))
      }
      setSearchParams(next, { replace: true })
    },
    [currentPage, searchParams, setSearchParams, totalJobs]
  )

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE))
    if (currentPage > totalPages) {
      handlePageChange(totalPages)
    }
  }, [currentPage, handlePageChange, totalJobs])

  useEffect(() => {
    setExpandedJobId(null)
  }, [currentPage, selectedToolkit, selectedStatus])

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

  const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE))
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < totalPages
  const firstItemIndex = totalJobs === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastItemIndex = totalJobs === 0 ? 0 : firstItemIndex + jobs.length - 1
  const rangeText =
    totalJobs === 0
      ? 'Showing 0 jobs'
      : jobs.length === 0
        ? `Showing 0 jobs (page ${currentPage} of ${totalPages})`
        : `Showing ${firstItemIndex}–${lastItemIndex} of ${totalJobs} jobs (page ${currentPage} of ${totalPages})`

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
        <label style={filterLabelStyle}>
          <span style={{ fontWeight: 600 }}>Status filter</span>
          <select value={selectedStatus} onChange={handleStatusChange} style={filterSelectStyle}>
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
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
                    <strong>
                      {job.toolkit ? toolkitNameLookup.get(job.toolkit) ?? job.toolkit : job.module || 'unknown'}
                    </strong>
                    <div style={jobOperationStyle}>{job.operation}</div>
                  </td>
                  <td style={jobStatusCellStyle}>{formatStatusLabel(job.status)}</td>
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
      {jobs.length === 0 && !loading && !error && <div style={emptyStateStyle}>No jobs match the selected filters.</div>}
      <div style={paginationContainerStyle}>
        <span style={paginationInfoStyle}>{rangeText}</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={!canGoPrev} style={paginationButtonStyle}>
            Previous
          </button>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={!canGoNext} style={paginationButtonStyle}>
            Next
          </button>
        </div>
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
