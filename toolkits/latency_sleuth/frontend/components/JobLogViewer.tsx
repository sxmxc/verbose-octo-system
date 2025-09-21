import { apiFetch, getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import { useJobStream } from '../hooks/useJobStream'
import { usePaginatedJobs } from '../hooks/usePaginatedJobs'
import type { ProbeExecutionSummary } from '../types'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return '—'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '—'
  const diff = Date.now() - timestamp
  const abs = Math.abs(diff)
  const seconds = Math.round(abs / 1000)
  if (seconds < 60) {
    return diff >= 0 ? `${seconds}s ago` : `in ${seconds}s`
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return diff >= 0 ? `${minutes}m ago` : `in ${minutes}m`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return diff >= 0 ? `${hours}h ago` : `in ${hours}h`
  }
  const days = Math.round(hours / 24)
  return diff >= 0 ? `${days}d ago` : `in ${days}d`
}

export default function JobLogViewer() {
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
    refresh: refreshTemplates,
  } = useProbeTemplates()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProbeExecutionSummary | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { job, loading: jobLoading, error: jobError, refresh } = useJobStream(jobId)
  const {
    jobs: visibleJobs,
    allJobs,
    totalJobs,
    hasMore,
    loadMore,
    loading: jobsLoading,
    error: jobsError,
    refresh: refreshJobs,
  } = usePaginatedJobs(selectedTemplate)
  const [lastJobsSignature, setLastJobsSignature] = useState<string | null>(null)

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: `${template.name} – SLA ${template.sla_ms}ms`,
      })),
    [templates],
  )

  const currentTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplate) ?? null,
    [templates, selectedTemplate],
  )

  useEffect(() => {
    setJobId(null)
    setPreview(null)
    setStatus(null)
    setLastJobsSignature(null)
  }, [selectedTemplate])

  useEffect(() => {
    if (allJobs.length === 0) {
      return
    }
    const signature = allJobs[0]?.updated_at || allJobs[0]?.created_at
    if (signature && signature !== lastJobsSignature) {
      setLastJobsSignature(signature)
      refreshTemplates()
    }
  }, [allJobs, lastJobsSignature, refreshTemplates])

  useEffect(() => {
    if (jobId || visibleJobs.length === 0) {
      return
    }
    setJobId(visibleJobs[0].id)
  }, [visibleJobs, jobId])

  const triggerPreview = async () => {
    if (!currentTemplate) return
    try {
      const response = await apiFetch<ProbeExecutionSummary>(
        `/toolkits/latency-sleuth/probe-templates/${currentTemplate.id}/actions/preview`,
        { method: 'POST', json: { sample_size: 3 } },
      )
      setPreview(response)
      setStatus('Preview generated')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to preview probe')
    }
  }

  const triggerRun = async () => {
    if (!currentTemplate) return
    setStatus(null)
    setJobId(null)
    try {
      const response = await apiFetch<{ job: { id: string } }>(
        `/toolkits/latency-sleuth/probe-templates/${currentTemplate.id}/actions/run`,
        { method: 'POST', json: { sample_size: 3 } },
      )
      setJobId(response.job.id)
      setStatus('Probe dispatched to workers')
      try {
        await refreshJobs()
      } catch (err) {
        console.warn('Failed to refresh job list after manual run', err)
      }
      refreshTemplates()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to start probe')
    }
  }

  const latestJob = allJobs.length > 0 ? allJobs[0] : null

  const renderLogs = () => {
    if (!job) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>Select a run to stream logs.</p>
    }

    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <header style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <strong>Job status: {job.status}</strong>
          <span>Progress: {job.progress}%</span>
          <button type="button" className="tk-button" onClick={() => refresh()} disabled={jobLoading}>
            Refresh
          </button>
        </header>
        <div className="tk-log-viewer">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
            {job.logs.map((log) => (
              <li key={log.ts} style={{ fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{new Date(log.ts).toLocaleTimeString()} </span>
                {log.message}
              </li>
            ))}
          </ul>
        </div>
        {job.result && (
          <pre className="tk-code-block" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(job.result, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  const renderJobTable = () => {
    if (!currentTemplate) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>Choose a template to inspect recent runs.</p>
    }

    if (jobsLoading && visibleJobs.length === 0) {
      return <p>Loading recent runs…</p>
    }

    if (visibleJobs.length === 0) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>No probe executions recorded yet.</p>
    }

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tk-table">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Run</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
            {visibleJobs.map((entry) => {
              const isActive = jobId === entry.id
              const trigger = entry.logs?.[0]?.message?.includes('Scheduled run enqueued') ? 'Scheduled' : 'Manual'
              return (
                <tr key={entry.id} style={isActive ? { background: 'var(--color-surface-muted)' } : undefined}>
                  <td>
                    <div style={{ display: 'grid' }}>
                      <span style={{ fontWeight: 600 }}>{trigger}</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{entry.status}</td>
                  <td>{entry.progress ?? 0}%</td>
                  <td>{formatRelativeTime(entry.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="tk-button"
                      onClick={() => setJobId(entry.id)}
                      disabled={isActive}
                    >
                      {isActive ? 'Viewing' : 'View logs'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        <footer style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Showing {visibleJobs.length} of {totalJobs} run{totalJobs === 1 ? '' : 's'}
          </span>
          {hasMore && (
            <button
              type="button"
              className="tk-button"
              onClick={loadMore}
              disabled={jobsLoading}
            >
              {jobsLoading ? 'Loading…' : 'Load older runs'}
            </button>
          )}
        </footer>
      </div>
    )
  }

  return (
    <div className="tk-card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
      <header>
        <h3 style={{ margin: 0 }}>Job Log Viewer</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
          Dispatch probes and stream worker logs directly from Redis telemetry.
        </p>
      </header>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <label className="tk-field-label">
          Probe template
          <select
            className="tk-select"
            value={selectedTemplate ?? ''}
            onChange={(event) => setSelectedTemplate(event.target.value || null)}
          >
            <option value="" disabled>
              {templatesLoading ? 'Loading templates…' : 'Choose a template'}
            </option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        {templatesError && <span style={{ color: 'var(--color-status-error)' }}>{templatesError}</span>}

        {currentTemplate && (
          <div className="tk-card" style={{ padding: '1rem', background: 'var(--color-surface-muted)' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Scheduling</h4>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Next automatic run {formatRelativeTime(currentTemplate.next_run_at ?? null)}
              {currentTemplate.next_run_at ? ` (${new Date(currentTemplate.next_run_at).toLocaleTimeString()})` : ''}.
              {latestJob && (
                <>
                  {' '}Last run {formatRelativeTime(latestJob.updated_at)} – status {latestJob.status}.
                </>
              )}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="tk-button" type="button" onClick={triggerPreview} disabled={!currentTemplate}>
            Preview run
          </button>
          <button className="tk-button tk-button--primary" type="button" onClick={triggerRun} disabled={!currentTemplate}>
            Run probe
          </button>
          {status && <span style={{ color: 'var(--color-text-secondary)' }}>{status}</span>}
          {jobError && <span style={{ color: 'var(--color-status-error)' }}>{jobError}</span>}
          {jobsError && <span style={{ color: 'var(--color-status-error)' }}>{jobsError}</span>}
        </div>
      </div>

      {preview && (
        <section className="tk-card" style={{ background: 'var(--color-surface-muted)', padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Preview summary</h4>
          <p style={{ margin: '0 0 0.5rem' }}>
            Average latency {preview.average_latency_ms} ms with {preview.breach_count} breach(es).
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.25rem' }}>
            {preview.samples.map((sample) => (
              <li key={sample.attempt}>
                Attempt {sample.attempt}: {sample.latency_ms} ms – {sample.breach ? 'breach' : 'ok'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ display: 'grid', gap: '1rem' }}>
        <div className="tk-card" style={{ padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Recent runs</h4>
          {renderJobTable()}
        </div>
        <div className="tk-card" style={{ padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Live logs</h4>
          {renderLogs()}
        </div>
      </section>
    </div>
  )
}
