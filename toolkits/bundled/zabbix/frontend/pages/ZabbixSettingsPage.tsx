import React, { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../runtime'
import type { ZabbixInstance } from './types'


type EditableInstance = {
  name: string
  base_url: string
  token: string
  verify_tls: boolean
  description: string
}


const initialForm: EditableInstance = {
  name: '',
  base_url: '',
  token: '',
  verify_tls: true,
  description: '',
}


const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
}

const iconStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}


export default function ZabbixAdministrationPage() {
  const [instances, setInstances] = useState<ZabbixInstance[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<EditableInstance>(initialForm)
  const [editForm, setEditForm] = useState<EditableInstance>(initialForm)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionOutput, setActionOutput] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)

  const loadInstances = useCallback(async () => {
    setError(null)
    try {
      const response = await apiFetch<ZabbixInstance[]>('/toolkits/zabbix/instances')
      setInstances(response)
      if (response.length > 0 && !selectedId) {
        setSelectedId(response[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [selectedId])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId],
  )

  useEffect(() => {
    if (selectedInstance) {
      setEditForm({
        name: selectedInstance.name,
        base_url: selectedInstance.base_url,
        token: '',
        verify_tls: selectedInstance.verify_tls,
        description: selectedInstance.description ?? '',
      })
    } else {
      setEditForm(initialForm)
    }
  }, [selectedInstance])

  const handleCreateChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = event.target
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleEditChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = event.target
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const createInstance = async (event: FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    setActionOutput('')
    setBusy(true)
    try {
      if (!createForm.name || !createForm.base_url || !createForm.token) {
        throw new Error('Name, base URL, and token are required.')
      }
      const payload = {
        name: createForm.name,
        base_url: createForm.base_url,
        token: createForm.token,
        verify_tls: createForm.verify_tls,
        description: createForm.description || undefined,
      }
      const created = await apiFetch<ZabbixInstance>('/toolkits/zabbix/instances', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setFeedback(`Instance "${created.name}" created.`)
      setCreateForm(initialForm)
      setSelectedId(created.id)
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const updateInstance = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedInstance) return
    setFeedback(null)
    setActionOutput('')
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        base_url: editForm.base_url,
        verify_tls: editForm.verify_tls,
        description: editForm.description,
      }
      if (editForm.token.trim()) {
        payload.token = editForm.token.trim()
      }
      const updated = await apiFetch<ZabbixInstance>(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setFeedback(`Instance "${updated.name}" updated.`)
      setEditForm((prev) => ({ ...prev, token: '' }))
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const deleteInstance = async () => {
    if (!selectedInstance) return
    if (!window.confirm(`Delete instance "${selectedInstance.name}"?`)) return
    setBusy(true)
    setFeedback(null)
    setActionOutput('')
    try {
      await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: 'DELETE',
        skipJson: true,
      })
      setFeedback(`Instance "${selectedInstance.name}" deleted.`)
      setSelectedId(null)
      await loadInstances()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const testInstance = async () => {
    if (!selectedInstance) return
    setActionOutput('Testing connection…')
    try {
      const response = await apiFetch<{ ok: boolean; version?: string; error?: string }>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/test`,
        { method: 'POST' },
      )
      setActionOutput(response.ok ? `OK — version ${response.version}` : `Failed: ${response.error}`)
    } catch (err) {
      setActionOutput(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-text-primary)' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            inventory_2
          </span>
          Instance registry
        </h4>
        {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                list_alt
              </span>
              Registered
            </h5>
            {instances.length === 0 && <p>No instances yet.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
              {instances.map((instance) => (
                <li key={instance.id}>
                  <button
                    onClick={() => setSelectedId(instance.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: selectedId === instance.id ? 'var(--color-link)' : 'var(--color-border)',
                      background: selectedId === instance.id ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                    }}
                  >
                    <strong>{instance.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{instance.base_url}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form style={{ flex: '1 1 320px' }} onSubmit={createInstance}>
            <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                add_business
              </span>
              Add instance
            </h5>
            <Field label="Name">
              <input
                className="tk-input"
                name="name"
                value={createForm.name}
                onChange={handleCreateChange}
                required
              />
            </Field>
            <Field label="Base URL">
              <input
                className="tk-input"
                name="base_url"
                value={createForm.base_url}
                onChange={handleCreateChange}
                placeholder="https://zabbix.example.com"
                required
              />
            </Field>
            <Field label="API Token">
              <input
                className="tk-input"
                name="token"
                value={createForm.token}
                onChange={handleCreateChange}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className="tk-input"
                name="description"
                value={createForm.description}
                onChange={handleCreateChange}
                rows={2}
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                name="verify_tls"
                checked={createForm.verify_tls}
                onChange={handleCreateChange}
              />
              Verify TLS certificates
            </label>
            <button type="submit" className="tk-button tk-button--primary" style={{ marginTop: '1rem' }} disabled={busy}>
              <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                add_circle
              </span>
              Create
            </button>
          </form>
        </div>
        {feedback && <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>{feedback}</p>}
      </section>

      {selectedInstance && (
        <section style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>{selectedInstance.name}</h4>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' }}>{selectedInstance.base_url}</p>
            </div>
            <button onClick={deleteInstance} disabled={busy} className="tk-button tk-button--danger">
              <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-danger-border)' }} aria-hidden>
                delete_forever
              </span>
              Delete
            </button>
          </div>

          <h5 style={{ margin: '1rem 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              tune
            </span>
            Instance configuration
          </h5>

          <form style={{ display: 'grid', gap: '0.75rem', maxWidth: 420 }} onSubmit={updateInstance}>
            <Field label="Name">
              <input
                className="tk-input"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
              />
            </Field>
            <Field label="Base URL">
              <input
                className="tk-input"
                name="base_url"
                value={editForm.base_url}
                onChange={handleEditChange}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className="tk-input"
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                rows={2}
              />
            </Field>
            <Field label="Update token (optional)">
              <input
                className="tk-input"
                name="token"
                value={editForm.token}
                onChange={handleEditChange}
                placeholder="Leave blank to keep"
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                name="verify_tls"
                checked={editForm.verify_tls}
                onChange={handleEditChange}
              />
              Verify TLS certificates
            </label>
            <button type="submit" className="tk-button tk-button--primary" disabled={busy}>
              <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                save
              </span>
              Save changes
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={testInstance} disabled={busy} className="tk-button">
              <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                network_check
              </span>
              Test connection
            </button>
          </div>

          {actionOutput && (
            <div style={{ marginTop: '1.25rem' }}>
              <strong>Result</strong>
              <pre style={resultStyle}>{actionOutput}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  )
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      {label}
      {children}
    </label>
  )
}


const resultStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontFamily: 'Source Code Pro, monospace',
  marginTop: '0.4rem',
  overflowX: 'auto',
  border: '1px solid var(--color-border)',
}
