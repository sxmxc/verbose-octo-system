import { apiFetch, getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import { useJobStream } from '../hooks/useJobStream'
import type { ProbeExecutionSummary } from '../types'

const React = getReactRuntime()
const { useMemo, useState } = React

export default function JobLogViewer() {
  const { templates, loading: templatesLoading, error: templatesError } = useProbeTemplates()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProbeExecutionSummary | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { job, loading: jobLoading, error: jobError, refresh } = useJobStream(jobId)

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
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to start probe')
    }
  }

  const renderLogs = () => {
    if (!job) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>Select a template and run a probe to stream logs.</p>
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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="tk-button" type="button" onClick={triggerPreview} disabled={!currentTemplate}>
            Preview run
          </button>
          <button className="tk-button tk-button--primary" type="button" onClick={triggerRun} disabled={!currentTemplate}>
            Run probe
          </button>
          {status && <span style={{ color: 'var(--color-text-secondary)' }}>{status}</span>}
          {jobError && <span style={{ color: 'var(--color-status-error)' }}>{jobError}</span>}
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

      <section>{renderLogs()}</section>
    </div>
  )
}
