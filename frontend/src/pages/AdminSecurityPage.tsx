import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'

type AuditEventDefinition = {
  name: string
  category: string
  description: string
  severity: string
}

type AuditActor = {
  id: string
  username: string
  display_name: string | null
  email: string | null
} | null

type AuditLogEntry = {
  id: string
  event: string
  severity: string
  category: string | null
  description: string | null
  created_at: string
  source_ip: string | null
  user_agent: string | null
  target_type: string | null
  target_id: string | null
  actor: AuditActor
  payload: Record<string, unknown> | null
}

type AuditLogResponse = {
  items: AuditLogEntry[]
  next_cursor: string | null
  events: AuditEventDefinition[]
}

type AuditFilters = {
  event: string
  severity: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  padding: '2rem',
  boxShadow: 'var(--color-shadow)',
  display: 'grid',
  gap: '1.75rem',
}

const filterRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '1rem',
}

const selectStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  padding: '0.6rem 0.75rem',
  background: 'var(--color-surface-alt, #fff)',
  color: 'var(--color-text-primary)',
}

const logItemStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '0.9rem',
  background: 'var(--color-surface-alt, rgba(255,255,255,0.65))',
}

const logListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1rem',
}

const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  borderRadius: 999,
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '0.2rem 0.7rem',
  textTransform: 'uppercase',
}

const mutedTextStyle: React.CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '0.85rem',
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch (err) {
    return value
  }
}

function severityBadgeStyle(severity: string): React.CSSProperties {
  const style: React.CSSProperties = { ...badgeBase }
  switch (severity) {
    case 'critical':
      style.background = 'rgba(220, 53, 69, 0.12)'
      style.color = '#b11b26'
      break
    case 'warning':
      style.background = 'rgba(255, 193, 7, 0.18)'
      style.color = '#946200'
      break
    case 'info':
    default:
      style.background = 'rgba(13, 110, 253, 0.12)'
      style.color = '#0b5ed7'
      break
  }
  return style
}

function renderActor(actor: AuditActor): string {
  if (!actor) {
    return 'System'
  }
  if (actor.display_name && actor.display_name.trim().length > 0) {
    return `${actor.display_name} (${actor.username})`
  }
  return actor.username
}

function renderTarget(log: AuditLogEntry): string {
  if (!log.target_type && !log.target_id) {
    return '—'
  }
  if (log.target_type && log.target_id) {
    return `${log.target_type} • ${log.target_id}`
  }
  return log.target_type || log.target_id || '—'
}

function payloadPreview(payload: Record<string, unknown> | null) {
  if (!payload || Object.keys(payload).length === 0) {
    return <span style={mutedTextStyle}>No additional context</span>
  }
  return (
    <pre
      style={{
        background: 'var(--color-surface)',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        margin: 0,
        padding: '0.75rem 1rem',
        fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
        fontSize: '0.8rem',
        overflowX: 'auto',
        color: 'var(--color-text-primary)',
      }}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

export default function AdminSecurityPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [events, setEvents] = useState<AuditEventDefinition[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AuditFilters>({ event: 'all', severity: 'all' })
  const requestRef = useRef(0)

  const loadLogs = useCallback(
    async ({ reset, cursor }: { reset?: boolean; cursor?: string | null } = {}) => {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setLoading(true)
      setError(null)
      try {
        if (reset) {
          setLogs([])
          setNextCursor(null)
        }
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (filters.event !== 'all') {
          params.set('event', filters.event)
        }
        if (filters.severity !== 'all') {
          params.set('severity', filters.severity)
        }
        if (cursor) {
          params.set('before', cursor)
        }
        const response = await apiFetch<AuditLogResponse>(`/admin/security/audit-logs?${params.toString()}`)
        if (requestId !== requestRef.current) {
          return
        }
        setEvents(response.events)
        setNextCursor(response.next_cursor)
        setLogs((prev) => (reset ? response.items : [...prev, ...response.items]))
      } catch (err) {
        if (requestId === requestRef.current) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false)
        }
      }
    },
    [filters]
  )

  useEffect(() => {
    void loadLogs({ reset: true })
  }, [loadLogs])

  const severityOptions = useMemo(() => {
    const options = new Set<string>(['info', 'warning', 'critical'])
    events.forEach((event) => options.add(event.severity))
    logs.forEach((log) => options.add(log.severity))
    return ['all', ...Array.from(options).sort()]
  }, [events, logs])

  const eventOptions = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.name.localeCompare(b.name))
    return [{ value: 'all', label: 'All events', description: 'Show every audit entry' }, ...sorted.map((event) => ({ value: event.name, label: event.name, description: event.description }))]
  }, [events])

  const selectedEventDefinition = useMemo(() => events.find((event) => event.name === filters.event), [events, filters.event])

  return (
    <div style={cardStyle}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MaterialIcon name="shield_lock" />
          Security audit trail
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Review authentication and administrative actions to support compliance monitoring and incident response.
        </p>
      </header>

      <section style={filterRowStyle}>
        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Event filter
          <select
            value={filters.event}
            onChange={(event) => {
              const value = event.target.value
              setFilters((prev) => ({ ...prev, event: value }))
            }}
            style={selectStyle}
          >
            {eventOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Severity
          <select
            value={filters.severity}
            onChange={(event) => {
              const value = event.target.value
              setFilters((prev) => ({ ...prev, severity: value }))
            }}
            style={selectStyle}
          >
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All severities' : option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadLogs({ reset: true })}
          style={{
            alignSelf: 'end',
            padding: '0.65rem 1rem',
            borderRadius: 10,
            border: '1px solid transparent',
            background: 'var(--color-sidebar-button-bg)',
            color: 'var(--color-sidebar-button-text)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            justifyContent: 'center',
          }}
        >
          <MaterialIcon name="refresh" /> Refresh
        </button>
      </section>

      {selectedEventDefinition && (
        <div style={{ ...mutedTextStyle, background: 'var(--color-surface-alt, rgba(0,0,0,0.02))', borderRadius: 8, padding: '0.75rem 1rem' }}>
          <strong>{selectedEventDefinition.name}</strong> · {selectedEventDefinition.description}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(220,53,69,0.12)', border: '1px solid rgba(220,53,69,0.4)', borderRadius: 10, padding: '0.9rem 1rem', color: '#842029' }}>
          {error}
        </div>
      )}

      <section style={logListStyle}>
        {logs.map((log) => (
          <article key={log.id} style={logItemStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{formatTimestamp(log.created_at)}</span>
              <span style={severityBadgeStyle(log.severity)}>{log.severity}</span>
            </div>
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>{log.event}</strong>
              {log.description && <span style={mutedTextStyle}>{log.description}</span>}
            </div>
            <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              <span>
                <strong>Actor:</strong> {renderActor(log.actor)}
              </span>
              <span>
                <strong>Target:</strong> {renderTarget(log)}
              </span>
              <span>
                <strong>Source:</strong> {log.source_ip || 'N/A'}
              </span>
              <span>
                <strong>User agent:</strong> {log.user_agent || 'N/A'}
              </span>
            </div>
            {payloadPreview(log.payload)}
          </article>
        ))}
        {!loading && logs.length === 0 && !error && (
          <div style={{ ...mutedTextStyle, textAlign: 'center', padding: '2rem 0' }}>No audit entries found for the selected filters.</div>
        )}
      </section>

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <span style={{ ...mutedTextStyle }}>
          Showing {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
        </span>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadLogs({ cursor: nextCursor })}
              disabled={loading}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: 10,
                border: '1px solid transparent',
                background: 'var(--color-sidebar-button-bg)',
                color: 'var(--color-sidebar-button-text)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                justifyContent: 'center',
                opacity: loading ? 0.7 : 1,
                pointerEvents: loading ? 'none' : 'auto',
              }}
            >
              <MaterialIcon name="expand_more" /> Load older
            </button>
          )}
          {loading && <span style={mutedTextStyle}>Loading…</span>}
        </div>
      </footer>
    </div>
  )
}
