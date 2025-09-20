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
  page: number
  page_size: number
  total: number
  pages: number
  events: AuditEventDefinition[]
  retention_days: number
}

type AuditFilters = {
  event: string
  severity: string
}

type AuditSettingsResponse = {
  retention_days: number
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

const retentionSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt, rgba(255,255,255,0.65))',
}

const retentionFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
}

const retentionInputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  padding: '0.5rem 0.75rem',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  width: '6rem',
}

const inlineMessageStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AuditFilters>({ event: 'all', severity: 'all' })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [retentionDays, setRetentionDays] = useState<number | null>(null)
  const [retentionDraft, setRetentionDraft] = useState('')
  const [retentionSaving, setRetentionSaving] = useState(false)
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const requestRef = useRef(0)

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const loadLogs = useCallback(
    async ({
      reset,
      targetPage,
      overridePageSize,
    }: {
      reset?: boolean
      targetPage?: number
      overridePageSize?: number
    } = {}) => {
      const requestId = requestRef.current + 1
      requestRef.current = requestId
      setLoading(true)
      setError(null)
      try {
        if (reset) {
          setLogs([])
          setExpandedIds(new Set())
        }
        const params = new URLSearchParams()
        const desiredPage = targetPage ?? 1
        const effectivePageSize = overridePageSize ?? pageSize
        params.set('page', String(desiredPage))
        params.set('page_size', String(effectivePageSize))
        if (filters.event !== 'all') {
          params.set('event', filters.event)
        }
        if (filters.severity !== 'all') {
          params.set('severity', filters.severity)
        }
        const response = await apiFetch<AuditLogResponse>(`/admin/security/audit-logs?${params.toString()}`)
        if (requestId !== requestRef.current) {
          return
        }
        setEvents(response.events)
        setRetentionDays(response.retention_days)
        setRetentionDraft(String(response.retention_days))
        setPage(response.page)
        setPageSize(response.page_size)
        setTotal(response.total)
        setPages(response.pages)
        setLogs(response.items)
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
    [filters, pageSize]
  )

  useEffect(() => {
    void loadLogs({ reset: true, targetPage: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const handleRetentionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const parsed = Number(retentionDraft)
      if (!Number.isFinite(parsed) || parsed < 1) {
        setRetentionMessage('Error: retention must be at least 1 day.')
        return
      }
      setRetentionSaving(true)
      setRetentionMessage(null)
      try {
        const response = await apiFetch<AuditSettingsResponse>('/admin/security/settings', {
          method: 'PUT',
          body: { retention_days: Math.floor(parsed) },
        })
        setRetentionDays(response.retention_days)
        setRetentionDraft(String(response.retention_days))
        setRetentionMessage('Retention updated successfully.')
        void loadLogs({ reset: true, targetPage: page })
      } catch (err) {
        setRetentionMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setRetentionSaving(false)
      }
    },
    [retentionDraft, loadLogs, page]
  )

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
              setPage(1)
              void loadLogs({ reset: true, targetPage: 1 })
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
              setPage(1)
              void loadLogs({ reset: true, targetPage: 1 })
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
        <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Page size
          <select
            value={pageSize}
            onChange={(event) => {
              const value = Number(event.target.value)
              setPageSize(value)
              setPage(1)
              void loadLogs({ reset: true, targetPage: 1, overridePageSize: value })
            }}
            style={selectStyle}
          >
            {[25, 50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value} per page
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadLogs({ reset: true, targetPage: page })}
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

      <section style={retentionSectionStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ color: 'var(--color-text-primary)' }}>Log retention</strong>
            <p style={{ ...mutedTextStyle, margin: '0.2rem 0 0' }}>
              Define how long audit entries are kept before automatic cleanup. Older records are purged immediately after changes.
            </p>
          </div>
        </header>
        <form onSubmit={handleRetentionSubmit} style={retentionFormStyle}>
          <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Retention (days)
            <input
              type="number"
              min={1}
              value={retentionDraft}
              onChange={(event) => setRetentionDraft(event.target.value)}
              style={retentionInputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={retentionSaving}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 10,
              border: '1px solid transparent',
              background: 'var(--color-sidebar-button-bg)',
              color: 'var(--color-sidebar-button-text)',
              fontWeight: 600,
              cursor: retentionSaving ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: retentionSaving ? 0.7 : 1,
            }}
          >
            <MaterialIcon name={retentionSaving ? 'hourglass_empty' : 'save'} />
            Save retention
          </button>
          {retentionDays !== null && (
            <span style={inlineMessageStyle}>Currently retaining for {retentionDays} day{retentionDays === 1 ? '' : 's'}.</span>
          )}
        </form>
        {retentionMessage && <div style={{ ...inlineMessageStyle }}>{retentionMessage}</div>}
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
        {logs.map((log) => {
          const isExpanded = expandedIds.has(log.id)
          const actorText = renderActor(log.actor)
          const targetText = renderTarget(log)
          const summaryText = targetText && targetText !== '—' ? `${actorText} → ${targetText}` : actorText
          return (
            <article key={log.id} style={logItemStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{formatTimestamp(log.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={severityBadgeStyle(log.severity)}>{log.severity}</span>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(log.id)}
                    aria-expanded={isExpanded}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <MaterialIcon name={isExpanded ? 'expand_less' : 'expand_more'} />
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>
                </div>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>{log.event}</strong>
                <span style={{ ...mutedTextStyle, display: 'block', marginTop: '0.25rem' }}>
                  {log.description || (isExpanded ? summaryText : '')}
                </span>
                {!isExpanded && (
                  <span style={{ ...mutedTextStyle, display: 'block', marginTop: '0.2rem', fontSize: '0.8rem' }}>{summaryText}</span>
                )}
              </div>
              {isExpanded && (
                <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  <span>
                    <strong>Actor:</strong> {actorText}
                  </span>
                  <span>
                    <strong>Target:</strong> {targetText}
                  </span>
                  <span>
                    <strong>Source:</strong> {log.source_ip || 'N/A'}
                  </span>
                  <span>
                    <strong>User agent:</strong> {log.user_agent || 'N/A'}
                  </span>
                </div>
              )}
              {isExpanded && payloadPreview(log.payload)}
            </article>
          )
        })}
        {!loading && logs.length === 0 && !error && (
          <div style={{ ...mutedTextStyle, textAlign: 'center', padding: '2rem 0' }}>No audit entries found for the selected filters.</div>
        )}
      </section>

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <span style={{ ...mutedTextStyle }}>
          Page {page} of {pages} · {total} entr{total === 1 ? 'y' : 'ies'}
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => page > 1 && loadLogs({ targetPage: page - 1 })}
            disabled={loading || page <= 1}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 10,
              border: '1px solid transparent',
              background: 'var(--color-sidebar-button-bg)',
              color: 'var(--color-sidebar-button-text)',
              fontWeight: 600,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              justifyContent: 'center',
              opacity: loading || page <= 1 ? 0.5 : 1,
            }}
          >
            <MaterialIcon name="chevron_left" /> Newer
          </button>
          <button
            type="button"
            onClick={() => page < pages && loadLogs({ targetPage: page + 1 })}
            disabled={loading || page >= pages}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 10,
              border: '1px solid transparent',
              background: 'var(--color-sidebar-button-bg)',
              color: 'var(--color-sidebar-button-text)',
              fontWeight: 600,
              cursor: page >= pages ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              justifyContent: 'center',
              opacity: loading || page >= pages ? 0.5 : 1,
            }}
          >
            Older <MaterialIcon name="chevron_right" />
          </button>
          {loading && <span style={mutedTextStyle}>Loading…</span>}
        </div>
      </footer>
    </div>
  )
}
