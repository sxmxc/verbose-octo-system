import type { CSSProperties } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type {
  BulkExportFormat,
  BulkExportTarget,
  Job,
  ZabbixBulkExportCatalogEntry,
  ZabbixBulkExportSummary,
} from './types'
import { useZabbixInstances } from './hooks'


const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
  display: 'grid',
  gap: '1rem',
}

const resultStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontFamily: 'Source Code Pro, monospace',
  marginTop: '0.4rem',
  overflowX: 'auto',
}

const calloutStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
  fontSize: '0.85rem',
  lineHeight: 1.45,
}


type BulkExportPreviewResponse = {
  ok: boolean
  summary: ZabbixBulkExportSummary
}

type BulkExportExecuteResponse = {
  job: Job
}


type CatalogState = {
  loading: boolean
  error: string | null
  entries: ZabbixBulkExportCatalogEntry[]
}


export default function ZabbixBulkExportPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading: instancesLoading, error: instancesError } =
    useZabbixInstances()
  const [catalogState, setCatalogState] = useState<CatalogState>({ loading: true, error: null, entries: [] })
  const [selectedTarget, setSelectedTarget] = useState<BulkExportTarget | ''>('')
  const [selectedFormat, setSelectedFormat] = useState<BulkExportFormat>('json')
  const [filterInput, setFilterInput] = useState<string>('')
  const [preview, setPreview] = useState<ZabbixBulkExportSummary | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  const [lastJobMessage, setLastJobMessage] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function loadCatalog() {
      setCatalogState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const entries = await apiFetch<ZabbixBulkExportCatalogEntry[]>(
          '/toolkits/zabbix/actions/bulk-export/catalog',
        )
        if (cancelled) return
        setCatalogState({ loading: false, error: null, entries })
      } catch (err) {
        if (cancelled) return
        setCatalogState({ loading: false, error: err instanceof Error ? err.message : String(err), entries: [] })
      }
    }

    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (catalogState.loading || catalogState.entries.length === 0) {
      return
    }
    setSelectedTarget((prev) => {
      if (prev) {
        const stillExists = catalogState.entries.some((entry) => entry.target === prev)
        if (stillExists) {
          return prev
        }
      }
      const first = catalogState.entries[0]
      return first.target
    })
  }, [catalogState.entries, catalogState.loading])

  useEffect(() => {
    if (!selectedTarget) return
    const entry = catalogState.entries.find((item) => item.target === selectedTarget)
    if (!entry) return
    setSelectedFormat(entry.default_format)
    if (entry.default_filters) {
      setFilterInput(JSON.stringify(entry.default_filters, null, 2))
    } else {
      setFilterInput('')
    }
  }, [selectedTarget, catalogState.entries])

  const selectedCatalogEntry = useMemo(
    () => catalogState.entries.find((entry) => entry.target === selectedTarget) ?? null,
    [catalogState.entries, selectedTarget],
  )

  const hasInstances = instances.length > 0
  const filtersLabel = selectedCatalogEntry?.filter_hint || 'Optional filter payload (JSON object)'

  const parseFilters = () => {
    if (!filterInput.trim()) {
      return {}
    }
    try {
      const parsed = JSON.parse(filterInput)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      throw new Error('Filters must be a JSON object')
    } catch (err) {
      throw new Error(
        err instanceof Error ? `Unable to parse filters: ${err.message}` : 'Unable to parse filters payload',
      )
    }
  }

  const performPreview = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    if (!selectedTarget) {
      setFeedback('Choose an export target.')
      return
    }

    setFeedback(null)
    setBusy(true)
    setLastJobMessage('')
    try {
      const filters = parseFilters()
      const response = await apiFetch<BulkExportPreviewResponse>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-export/preview`,
        {
          method: 'POST',
          body: JSON.stringify({ target: selectedTarget, format: selectedFormat, filters }),
        },
      )
      setPreview(response.summary)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const enqueueExport = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    if (!selectedTarget) {
      setFeedback('Choose an export target.')
      return
    }

    setFeedback(null)
    setBusy(true)
    try {
      const filters = parseFilters()
      const response = await apiFetch<BulkExportExecuteResponse>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-export/execute`,
        {
          method: 'POST',
          body: JSON.stringify({ target: selectedTarget, format: selectedFormat, filters }),
        },
      )
      setLastJobMessage(`Job queued with id ${response.job.id}`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <section style={sectionStyle}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            dataset
          </span>
          Bulk data exports
        </h4>
        <p style={{ margin: '0.25rem 0 0.75rem', color: 'var(--color-text-secondary)' }}>
          Generate exports for common Zabbix entities. Preview the dataset shape before queueing asynchronous jobs.
        </p>

        {catalogState.loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading export catalog…</p>}
        {catalogState.error && <p style={{ color: 'var(--color-danger-border)' }}>{catalogState.error}</p>}
        {instancesLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading instances…</p>}
        {instancesError && <p style={{ color: 'var(--color-danger-border)' }}>{instancesError}</p>}

        {!instancesLoading && !hasInstances && (
          <p style={{ color: 'var(--color-text-secondary)' }}>Define at least one instance under Administration.</p>
        )}

        {hasInstances && catalogState.entries.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 340 }}>
              Target instance
              <select
                className="tk-input"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {instances.map((instance) => (
                  <option value={instance.id} key={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label className="tk-label" style={{ display: 'grid', gap: '0.3rem' }}>
                Export target
                <select
                  className="tk-input"
                  value={selectedTarget}
                  onChange={(event) => setSelectedTarget(event.target.value as BulkExportTarget)}
                >
                  {catalogState.entries.map((entry) => (
                    <option key={entry.target} value={entry.target}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCatalogEntry && (
                <div style={calloutStyle}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-primary)' }}>
                    {selectedCatalogEntry.label}
                  </strong>
                  <span>{selectedCatalogEntry.description}</span>
                  {selectedCatalogEntry.notes && (
                    <span style={{ display: 'block', marginTop: '0.4rem' }}>{selectedCatalogEntry.notes}</span>
                  )}
                </div>
              )}

              <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', maxWidth: 240 }}>
                Output format
                <select
                  className="tk-input"
                  value={selectedFormat}
                  onChange={(event) => setSelectedFormat(event.target.value as BulkExportFormat)}
                >
                  {selectedCatalogEntry?.supported_formats.map((format) => (
                    <option value={format} key={format}>
                      {format.toUpperCase()}
                    </option>
                  )) ?? null}
                </select>
              </label>

              <label className="tk-label" style={{ display: 'grid', gap: '0.3rem' }}>
                {filtersLabel}
                <textarea
                  className="tk-input"
                  rows={selectedCatalogEntry?.default_filters ? 6 : 4}
                  value={filterInput}
                  onChange={(event) => setFilterInput(event.target.value)}
                  placeholder={'{\n  "status": 0\n}'}
                />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="tk-button" onClick={performPreview} disabled={busy}>
                  <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                    preview
                  </span>
                  Preview dataset
                </button>
                <button type="button" className="tk-button tk-button--primary" onClick={enqueueExport} disabled={busy}>
                  <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                    cloud_upload
                  </span>
                  Queue export job
                </button>
              </div>

              {feedback && (
                <p style={{ color: 'var(--color-text-secondary)' }}>{feedback}</p>
              )}
              {lastJobMessage && (
                <p style={{ color: 'var(--color-text-secondary)' }}>{lastJobMessage}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {preview && (
        <section style={sectionStyle}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              dataset_linked
            </span>
            Preview summary
          </h4>
          <div style={{ display: 'grid', gap: '0.4rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Target:</strong> {preview.target}
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Format:</strong> {preview.format.toUpperCase()}
            </div>
            <div>
              <strong style={{ color: 'var(--color-text-primary)' }}>Estimated records:</strong> {preview.estimated_records}
            </div>
            {preview.filters_applied && (
              <div>
                <strong style={{ color: 'var(--color-text-primary)' }}>Filters:</strong>
                <pre style={resultStyle}>{JSON.stringify(preview.filters_applied, null, 2)}</pre>
              </div>
            )}
            {preview.notes && <div>{preview.notes}</div>}
          </div>
          <div>
            <h5 style={{ margin: '0.75rem 0 0.3rem' }}>Sample fields</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {preview.sample_fields.map((field) => (
                <span key={field} className="tk-tag">
                  {field}
                </span>
              ))}
            </div>
          </div>
          {preview.sample_rows.length > 0 && (
            <div>
              <h5 style={{ margin: '0.75rem 0 0.3rem' }}>Sample rows</h5>
              <pre style={resultStyle}>{JSON.stringify(preview.sample_rows, null, 2)}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
