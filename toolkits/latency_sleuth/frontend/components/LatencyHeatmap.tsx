import { apiFetch, getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import type { HeatmapCell, LatencyHeatmap } from '../types'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

function computeHeatColor(cell: HeatmapCell, slaMs: number | undefined) {
  const sla = slaMs || 1
  const ratio = Math.max(0, Math.min(cell.latency_ms / sla, 2.5))
  const hue = Math.max(0, Math.min(120, 120 - ratio * 70))
  const saturation = 75
  const lightness = cell.breach ? 45 : 55 + Math.max(0, 1 - ratio) * 10
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export default function LatencyHeatmapView() {
  const { templates, loading: templatesLoading, error: templatesError } = useProbeTemplates()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [heatmap, setHeatmap] = useState<LatencyHeatmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

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
  }, [currentTemplate, refreshToken])

  const renderLegend = () => {
    if (!currentTemplate) {
      return null
    }
    const sampleValues = [0.5, 0.9, 1, 1.25, 1.5, 2]
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Latency vs SLA</span>
        {sampleValues.map((ratio) => {
          const fakeCell: HeatmapCell = {
            timestamp: new Date().toISOString(),
            latency_ms: currentTemplate.sla_ms * ratio,
            breach: ratio > 1,
          }
          return (
            <span
              key={ratio}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: computeHeatColor(fakeCell, currentTemplate.sla_ms),
                  border: ratio > 1 ? '1px solid var(--color-status-error-border)' : '1px solid transparent',
                }}
              />
              <span style={{ color: 'var(--color-text-secondary)' }}>{Math.round(ratio * 100)}%</span>
            </span>
          )
        })}
      </div>
    )
  }

  const renderGrid = () => {
    if (!heatmap || heatmap.rows.length === 0) {
      return <p style={{ color: 'var(--color-text-secondary)' }}>No probe executions recorded yet.</p>
    }

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {heatmap.rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: 'grid',
              gap: '0.5rem',
              gridTemplateColumns: `repeat(${heatmap.columns}, minmax(40px, 1fr))`,
            }}
          >
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                title={`${new Date(cell.timestamp).toLocaleString()} — ${cell.latency_ms} ms`}
                style={{
                  padding: '0.75rem 0.5rem',
                  borderRadius: 6,
                  border: cell.breach ? '1px solid var(--color-status-error-border)' : '1px solid transparent',
                  background: computeHeatColor(cell, currentTemplate?.sla_ms),
                  color: 'var(--color-surface)',
                  fontWeight: 600,
                }}
                role="img"
                aria-label={`${Math.round(cell.latency_ms)} ms on ${new Date(cell.timestamp).toLocaleString()}`}
              >
                <span style={{ display: 'block', fontSize: '0.9rem' }}>{Math.round(cell.latency_ms)}</span>
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

      {currentTemplate && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {renderLegend()}
          <button
            className="tk-button"
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      )}

      {loading ? <p>Loading heatmap…</p> : renderGrid()}
    </div>
  )
}
