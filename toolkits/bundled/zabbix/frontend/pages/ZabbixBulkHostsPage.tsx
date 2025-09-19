import type { CSSProperties, ReactNode } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type { Job } from './types'
import { useZabbixInstances } from './hooks'


type HostRowForm = {
  host: string
  ip: string
  groups: string
  templates: string
  macros: string
}


const initialRow: HostRowForm = {
  host: 'demo-host-1',
  ip: '10.0.0.10',
  groups: '',
  templates: '',
  macros: '',
}

const React = getReactRuntime()
const { useMemo, useState } = React

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}


export default function ZabbixBulkHostsPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading, error } = useZabbixInstances()
  const [hostRows, setHostRows] = useState<HostRowForm[]>([initialRow])
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hasInstances = instances.length > 0

  const buildRowsPayload = useMemo(
    () => () =>
      hostRows.map((row) => ({
        host: row.host,
        ip: row.ip,
        groups: splitCsv(row.groups),
        templates: splitCsv(row.templates),
        macros: parseKeyValue(row.macros),
      })),
    [hostRows],
  )

  const updateHostRow = (index: number, field: keyof HostRowForm, value: string) => {
    setHostRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  }

  const addHostRow = () =>
    setHostRows((prev) => [...prev, { host: '', ip: '', groups: '', templates: '', macros: '' }])

  const removeHostRow = (index: number) => setHostRows((prev) => prev.filter((_, idx) => idx !== index))

  const performDryRun = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
    setResultText('')
    setBusy(true)
    try {
      const payload = { rows: buildRowsPayload(), dry_run: true }
      const response = await apiFetch<{ ok: boolean; summary?: unknown }>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/dry-run`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      setResultText(JSON.stringify(response, null, 2))
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const performExecute = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
    setResultText('')
    setBusy(true)
    try {
      const payload = { rows: buildRowsPayload(), dry_run: false }
      const response = await apiFetch<{ job: Job }>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/execute`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      setResultText(`Job queued with id ${response.job.id}`)
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            group_add
          </span>
          Bulk host creation
        </h4>
        <p style={{ margin: '0.25rem 0 1rem', color: 'var(--color-text-secondary)' }}>
          Compose host rows, preview via dry run, or enqueue a job for asynchronous execution.
        </p>

        {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading instances…</p>}
        {!loading && !hasInstances && <p style={{ color: 'var(--color-text-secondary)' }}>Define at least one instance under Administration.</p>}

        {error && (
          <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>
        )}

        {hasInstances && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 320 }}>
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
              {hostRows.map((row, idx) => (
                <div key={`${idx}-${row.host || 'row'}`} style={rowCardStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Field label="Host">
                      <input
                        className="tk-input"
                        value={row.host}
                        onChange={(e) => updateHostRow(idx, 'host', e.target.value)}
                      />
                    </Field>
                    <Field label="IP">
                      <input
                        className="tk-input"
                        value={row.ip}
                        onChange={(e) => updateHostRow(idx, 'ip', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Groups (comma separated)">
                    <input
                      className="tk-input"
                      value={row.groups}
                      onChange={(e) => updateHostRow(idx, 'groups', e.target.value)}
                    />
                  </Field>
                  <Field label="Templates (comma separated)">
                    <input
                      className="tk-input"
                      value={row.templates}
                      onChange={(e) => updateHostRow(idx, 'templates', e.target.value)}
                    />
                  </Field>
                  <Field label="Macros (key=value per line)">
                    <textarea
                      className="tk-input"
                      value={row.macros}
                      onChange={(e) => updateHostRow(idx, 'macros', e.target.value)}
                      rows={2}
                    />
                  </Field>
                  {hostRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHostRow(idx)}
                      className="tk-button tk-button--danger"
                      style={{ width: 'fit-content' }}
                    >
                      <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-danger-border)' }} aria-hidden>
                        remove_circle
                      </span>
                      Remove host
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addHostRow}
                className="tk-button"
                style={{ width: 'fit-content' }}
              >
                <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                  add_circle
                </span>
                Add host
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={performDryRun} className="tk-button" disabled={busy}>
                <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                  preview
                </span>
                Dry run
              </button>
              <button type="button" onClick={performExecute} className="tk-button tk-button--primary" disabled={busy}>
                <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                  play_circle
                </span>
                Execute
              </button>
            </div>

            {feedback && (
              <p style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                  info
                </span>
                {feedback}
              </p>
            )}
          </div>
        )}
      </section>

      {resultText && (
        <section style={sectionStyle}>
          <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              description
            </span>
            Result
          </h4>
          <pre style={resultStyle}>{resultText}</pre>
        </section>
      )}
    </div>
  )
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      {label}
      {children}
    </label>
  )
}


const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
}

const rowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  background: 'var(--color-surface)',
  padding: '0.85rem',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
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


function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseKeyValue(value: string): Record<string, string> {
  const result: Record<string, string> = {}
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (!key) {
        return
      }
      result[key.trim()] = rest.join('=').trim()
    })
  return result
}
