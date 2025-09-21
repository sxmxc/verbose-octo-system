import { apiFetch, getReactRuntime } from '../runtime'
import StatusIndicator, { getStatusConfig } from '../components/StatusIndicator'
import type { ComponentHealth, HealthSummary } from './types'

const React = getReactRuntime()

const componentDescriptions: Record<string, string> = {
  frontend: 'Renders the administrative UI and serves static assets.',
  backend: 'Provides the REST API, database access, and authentication.',
  worker: 'Processes asynchronous jobs, schedules automation, and handles long-running tasks.',
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return 'Unknown'
  }
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return date.toLocaleString()
  } catch (error) {
    return value
  }
}

function formatLatency(latency?: number | null) {
  if (latency === null || typeof latency === 'undefined') {
    return '—'
  }
  return `${Math.round(latency)} ms`
}

function HealthCard({ summary }: { summary: HealthSummary }) {
  const overallConfig = getStatusConfig(summary.overall_status)

  return (
    <section
      className="tk-card"
      style={{
        display: 'grid',
        gap: '1rem',
        padding: '1.5rem',
        border: `1px solid ${overallConfig.color}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <StatusIndicator status={summary.overall_status} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Last checked {formatTimestamp(summary.checked_at)}
          </span>
        </div>
        <h4 style={{ margin: 0 }}>Toolbox core services</h4>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{summary.notes}</p>
      </div>
    </section>
  )
}

function ComponentGrid({ components }: { components: ComponentHealth[] }) {
  return (
    <section className="tk-card" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--color-link)' }} aria-hidden>
            lan
          </span>
          Component details
        </h4>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Click refresh to capture a new snapshot.
        </span>
      </header>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {components.map((component) => {
          const description = componentDescriptions[component.component] ?? 'Monitored service.'
          return (
            <article
              key={component.component}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '1rem',
                display: 'grid',
                gap: '0.75rem',
                background: 'var(--color-surface)',
              }}
            >
              <header style={{ display: 'grid', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1rem' }}>{component.component.toUpperCase()}</strong>
                  <StatusIndicator status={component.status} />
                </div>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{description}</p>
              </header>

              <dl style={{ margin: 0, display: 'grid', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <dt style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Message</dt>
                  <dd style={{ margin: 0, textAlign: 'right', color: 'var(--color-text-primary)' }}>{component.message}</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <dt style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Latency</dt>
                  <dd style={{ margin: 0, textAlign: 'right' }}>{formatLatency(component.latency_ms)}</dd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <dt style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Checked</dt>
                  <dd style={{ margin: 0, textAlign: 'right' }}>{formatTimestamp(component.checked_at)}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default function OverviewPage() {
  const { useCallback, useEffect, useMemo, useState } = React
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const fetchSummary = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<HealthSummary>('/toolkits/toolbox-health/health/summary', {
        signal,
        cache: 'no-store',
      })
      setSummary(response)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to load health summary.')
    } finally {
      setLoading(false)
    }
  }, [setSummary])

  useEffect(() => {
    const controller = new AbortController()
    fetchSummary(controller.signal).catch(() => {
      setError('Failed to load health summary.')
    })
    return () => controller.abort()
  }, [fetchSummary, refreshIndex])

  const refresh = useCallback(() => {
    setRefreshIndex((index) => index + 1)
  }, [])

  const components = useMemo(() => summary?.components ?? [], [summary])

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="tk-button tk-button--secondary"
          onClick={refresh}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span className="material-symbols-outlined" aria-hidden>
            {loading ? 'hourglass_top' : 'refresh'}
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="tk-card"
          style={{
            border: '1px solid var(--color-danger-border)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            padding: '1rem',
          }}
        >
          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" aria-hidden>
              error
            </span>
            Unable to update health status
          </strong>
          <span style={{ marginTop: '0.35rem', display: 'block' }}>{error}</span>
        </div>
      )}

      {summary && <HealthCard summary={summary} />}

      {components.length > 0 && <ComponentGrid components={components} />}

      {!loading && !summary && !error && (
        <p style={{ color: 'var(--color-text-secondary)' }}>No health data available.</p>
      )}
    </div>
  )
}

