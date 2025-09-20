import { apiFetch, getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import type { HeatmapCell, LatencyHeatmap } from '../types'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

function cellColor(cell: HeatmapCell) {
  if (cell.breach) {
    return 'var(--color-status-error-muted)'
  }
  return 'var(--color-status-success-muted)'
}

export default function LatencyHeatmapView() {
  const { templates, loading: templatesLoading, error: templatesError } = useProbeTemplates()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [heatmap, setHeatmap] = useState<LatencyHeatmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplate) ?? null,
    [templates, selectedTemplate],
  )

  useEffect(() => {
    if (!currentTemplate) {
      setHeatmap(null)
      return
    }

    let cancelled = false
    const fetchHeatmap = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiFetch<LatencyHeatmap>(
          `/toolkits/latency-sleuth/probe-templates/${currentTemplate.id}/heatmap`,
          { method: 'GET' },
        )
        if (!cancelled) {
          setHeatmap(response)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load heatmap')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchHeatmap()

    return () => {
      cancelled = true
    }
  }, [currentTemplate])

  const renderGrid = () => {
    if (!heatmap || heatmap.rows.length === 0) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>No probe executions recorded yet.</p>
    }

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {heatmap.rows.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: `repeat(${heatmap.columns}, minmax(40px, 1fr))` }}>
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                title={`${new Date(cell.timestamp).toLocaleString()} — ${cell.latency_ms} ms`}
                style={{
                  padding: '0.65rem 0.35rem',
                  textAlign: 'center',
                  borderRadius: 6,
                  background: cellColor(cell),
                  color: cell.breach ? 'var(--color-status-error-text)' : 'var(--color-status-success-text)',
                  fontWeight: 600,
                }}
              >
                {Math.round(cell.latency_ms)}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="tk-card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
      <header>
        <h3 style={{ margin: 0 }}>Latency Heatmap</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
          Spot drift in synthetic response times and correlate with SLA breaches.
        </p>
      </header>

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
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      {templatesError && <span style={{ color: 'var(--color-status-error)' }}>{templatesError}</span>}
      {error && <span style={{ color: 'var(--color-status-error)' }}>{error}</span>}

      {loading ? <p>Loading heatmap…</p> : renderGrid()}
    </div>
  )
}
