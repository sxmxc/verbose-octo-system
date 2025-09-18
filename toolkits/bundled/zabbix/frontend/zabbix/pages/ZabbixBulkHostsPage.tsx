import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../../../api'
import { Job, ZabbixInstance } from '../../../types'


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


export default function ZabbixBulkHostsPage() {
  const [instances, setInstances] = useState<ZabbixInstance[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [hostRows, setHostRows] = useState<HostRowForm[]>([initialRow])
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const loadInstances = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ZabbixInstance[]>('/toolkits/zabbix/instances')
      setInstances(data)
      if (data.length > 0) {
        setSelectedId((prev) => prev || data[0].id)
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId],
  )

  const updateHostRow = (index: number, field: keyof HostRowForm, value: string) => {
    setHostRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)))
  }

  const addHostRow = () =>
    setHostRows((prev) => [...prev, { host: '', ip: '', groups: '', templates: '', macros: '' }])

  const removeHostRow = (index: number) => setHostRows((prev) => prev.filter((_, idx) => idx !== index))

  const buildRowsPayload = () =>
    hostRows.map((row) => ({
      host: row.host,
      ip: row.ip,
      groups: splitCsv(row.groups),
      templates: splitCsv(row.templates),
      macros: parseKeyValue(row.macros),
    }))

  const performDryRun = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
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
    }
  }

  const performExecute = async () => {
    if (!selectedInstance) {
      setFeedback('Select an instance first.')
      return
    }
    setFeedback(null)
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
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0 }}>Bulk host creation</h4>
        <p style={{ margin: '0.25rem 0 1rem', color: '#64748b' }}>
          Compose host rows, preview via dry run, or enqueue a job for asynchronous execution.
        </p>

        {loading && <p>Loading instances…</p>}
        {instances.length === 0 && !loading && <p>Add an instance in Settings before running actions.</p>}

        {instances.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 320 }}>
              Target instance
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {instances.map((instance) => (
                  <option value={instance.id} key={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {hostRows.map((row, idx) => (
                <div key={idx} style={rowCardStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Field label="Host">
                      <input value={row.host} onChange={(e) => updateHostRow(idx, 'host', e.target.value)} />
                    </Field>
                    <Field label="IP">
                      <input value={row.ip} onChange={(e) => updateHostRow(idx, 'ip', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Groups (comma separated)">
                    <input value={row.groups} onChange={(e) => updateHostRow(idx, 'groups', e.target.value)} />
                  </Field>
                  <Field label="Templates (comma separated)">
                    <input value={row.templates} onChange={(e) => updateHostRow(idx, 'templates', e.target.value)} />
                  </Field>
                  <Field label="Macros (key=value per line)">
                    <textarea value={row.macros} onChange={(e) => updateHostRow(idx, 'macros', e.target.value)} rows={2} />
                  </Field>
                  {hostRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHostRow(idx)}
                      style={{ width: 'fit-content', background: '#fee2e2', border: '1px solid #f87171' }}
                    >
                      Remove host
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addHostRow} style={{ width: 'fit-content' }}>
                Add host
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={performDryRun}>
                Dry run
              </button>
              <button type="button" onClick={performExecute}>
                Execute
              </button>
            </div>

            {feedback && <p style={{ color: '#0284c7' }}>{feedback}</p>}
          </div>
        )}
      </section>

      {resultText && (
        <section style={sectionStyle}>
          <h4 style={{ marginTop: 0 }}>Result</h4>
          <pre style={resultStyle}>{resultText}</pre>
        </section>
      )}
    </div>
  )
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      {label}
      {children}
    </label>
  )
}


const sectionStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.25rem',
  background: '#f8fafc',
}

const rowCardStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  background: '#fff',
  padding: '0.85rem',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
}

const resultStyle: React.CSSProperties = {
  background: '#fff',
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
      if (key && rest.length > 0) {
        result[key.trim()] = rest.join('=').trim()
      }
    })
  return result
}
