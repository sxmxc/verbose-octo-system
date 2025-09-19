import type { ChangeEvent, FormEvent, ReactNode, CSSProperties } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type { ConnectivityTarget, ProbeEndpoint, ProbePort } from './types'
import { useConnectivityTargets } from './hooks'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

const sectionStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
}

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

type EndpointForm = {
  host: string
  ports: string
}

const emptyEndpoint: EndpointForm = {
  host: '',
  ports: '80,443',
}

export default function TargetsPage() {
  const { targets, selectedId, setSelectedId, selectedTarget, loading, error, refresh } = useConnectivityTargets()
  const [createForm, setCreateForm] = useState({ name: '', description: '', endpoints: [emptyEndpoint] })
  const [editForm, setEditForm] = useState({ name: '', description: '', endpoints: [emptyEndpoint] })
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (selectedTarget) {
      setEditForm({
        name: selectedTarget.name,
        description: selectedTarget.description ?? '',
        endpoints:
          selectedTarget.endpoints.length > 0
            ? selectedTarget.endpoints.map((endpoint) => ({
                host: endpoint.host,
                ports: endpoint.ports.map((port) => port.protocol === 'tcp' ? String(port.port) : `${port.port}/${port.protocol}`).join(', '),
              }))
            : [emptyEndpoint],
      })
    } else {
      setEditForm({ name: '', description: '', endpoints: [emptyEndpoint] })
    }
  }, [selectedTarget])

  const endpointCount = useMemo(
    () => targets.reduce((sum, target) => sum + target.endpoint_count, 0),
    [targets],
  )

  const handleCreateChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setCreateForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const updateEndpoint = (
    formType: 'create' | 'edit',
    index: number,
    field: keyof EndpointForm,
    value: string,
  ) => {
    const setter = formType === 'create' ? setCreateForm : setEditForm
    setter((prev) => ({
      ...prev,
      endpoints: prev.endpoints.map((endpoint, idx) => (idx === index ? { ...endpoint, [field]: value } : endpoint)),
    }))
  }

  const addEndpoint = (formType: 'create' | 'edit') => {
    const setter = formType === 'create' ? setCreateForm : setEditForm
    setter((prev) => ({ ...prev, endpoints: [...prev.endpoints, { ...emptyEndpoint }] }))
  }

  const removeEndpoint = (formType: 'create' | 'edit', index: number) => {
    const setter = formType === 'create' ? setCreateForm : setEditForm
    setter((prev) => ({ ...prev, endpoints: prev.endpoints.filter((_, idx) => idx !== index) }))
  }

  const buildPayload = (form: { name: string; description: string; endpoints: EndpointForm[] }) => {
    const endpoints: ProbeEndpoint[] = form.endpoints
      .filter((endpoint) => endpoint.host.trim())
      .map((endpoint) => ({
        host: endpoint.host.trim(),
        ports: parsePorts(endpoint.ports),
      }))
    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      endpoints,
    }
  }

  const createTarget = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      const payload = buildPayload(createForm)
      if (!payload.name) {
        throw new Error('Name is required')
      }
      const created = await apiFetch<ConnectivityTarget>('/toolkits/connectivity/targets', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setFeedback(`Created probe group "${created.name}".`)
      setCreateForm({ name: '', description: '', endpoints: [emptyEndpoint] })
      await refresh()
      setSelectedId(created.id)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const updateTarget = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedTarget) {
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const payload = buildPayload(editForm)
      const updated = await apiFetch<ConnectivityTarget>(
        `/toolkits/connectivity/targets/${selectedTarget.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      )
      setFeedback(`Updated probe group "${updated.name}".`)
      await refresh()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const deleteTarget = async () => {
    if (!selectedTarget) {
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      await apiFetch(`/toolkits/connectivity/targets/${selectedTarget.id}` , {
        method: 'DELETE',
      })
      setFeedback(`Deleted probe group "${selectedTarget.name}".`)
      await refresh()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            hub
          </span>
          Probe groups
        </h4>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <h5 style={{ margin: '0 0 0.5rem', color: 'var(--color-text-secondary)' }}>
                Groups ({targets.length})
              </h5>
              {targets.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No probe groups yet.</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
                {targets.map((target) => (
                  <li key={target.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(target.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        borderRadius: 8,
                        border: '1px solid',
                        borderColor: selectedId === target.id ? 'var(--color-link)' : 'var(--color-border)',
                        background: selectedId === target.id ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                      }}
                    >
                      <strong>{target.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {target.endpoint_count} endpoint{target.endpoint_count === 1 ? '' : 's'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <form style={{ flex: '1 1 320px' }} onSubmit={createTarget}>
              <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                  add_circle
                </span>
                Add group
              </h5>
              <Field label="Name">
                <input className="tk-input" name="name" value={createForm.name} onChange={handleCreateChange} required />
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
              <EndpointList
                endpoints={createForm.endpoints}
                onChange={(index, field, value) => updateEndpoint('create', index, field, value)}
                onAdd={() => addEndpoint('create')}
                onRemove={(index) => removeEndpoint('create', index)}
              />
              <button type="submit" className="tk-button tk-button--primary" disabled={busy} style={{ marginTop: '0.75rem' }}>
                Create
              </button>
            </form>

            {selectedTarget && (
              <form style={{ flex: '1 1 320px' }} onSubmit={updateTarget}>
                <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                    tune
                  </span>
                  Edit “{selectedTarget.name}”
                </h5>
                <Field label="Name">
                  <input className="tk-input" name="name" value={editForm.name} onChange={handleEditChange} required />
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
                <EndpointList
                  endpoints={editForm.endpoints}
                  onChange={(index, field, value) => updateEndpoint('edit', index, field, value)}
                  onAdd={() => addEndpoint('edit')}
                  onRemove={(index) => removeEndpoint('edit', index)}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="tk-button tk-button--primary" disabled={busy}>
                    Save changes
                  </button>
                  <button type="button" className="tk-button tk-button--danger" onClick={deleteTarget} disabled={busy}>
                    Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
        {feedback && <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>{feedback}</p>}
      </section>

      <section style={sectionStyle}>
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            data_thresholding
          </span>
          Inventory snapshot
        </h4>
        <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 0.5rem' }}>
          {targets.length} groups, {endpointCount} endpoints configured.
        </p>
      </section>
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

function EndpointList({
  endpoints,
  onChange,
  onAdd,
  onRemove,
}: {
  endpoints: EndpointForm[]
  onChange: (index: number, field: keyof EndpointForm, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
      <h6 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Endpoints</h6>
      {endpoints.map((endpoint, idx) => (
        <div
          key={`${endpoint.host}-${idx}`}
          style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.75rem', background: 'var(--color-surface)' }}
        >
          <Field label="Host">
            <input
              className="tk-input"
              value={endpoint.host}
              onChange={(event) => onChange(idx, 'host', event.target.value)}
              placeholder="app.example.com"
            />
          </Field>
          <Field label="Ports (comma separated, use 53/udp for UDP)">
            <input
              className="tk-input"
              value={endpoint.ports}
              onChange={(event) => onChange(idx, 'ports', event.target.value)}
              placeholder="80,443,53/udp"
            />
          </Field>
          {endpoints.length > 1 && (
            <button type="button" className="tk-button tk-button--danger" onClick={() => onRemove(idx)}>
              Remove endpoint
            </button>
          )}
        </div>
      ))}
      <button type="button" className="tk-button" onClick={onAdd}>
        Add endpoint
      </button>
    </div>
  )
}

function parsePorts(value: string): ProbePort[] {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return [{ port: 80, protocol: 'tcp' }]
  }

  return tokens.map((token) => {
    const [portPart, protocolPart] = token.split('/')
    const port = Number.parseInt(portPart, 10)
    if (Number.isNaN(port)) {
      throw new Error(`Invalid port value: ${token}`)
    }
    const protocol = protocolPart ? protocolPart.toLowerCase() : 'tcp'
    if (protocol !== 'tcp' && protocol !== 'udp') {
      throw new Error(`Unsupported protocol: ${protocol}`)
    }
    return { port, protocol: protocol as 'tcp' | 'udp' }
  })
}
