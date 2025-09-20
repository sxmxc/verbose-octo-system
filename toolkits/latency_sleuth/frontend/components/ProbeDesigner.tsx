import { getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import type { NotificationRule, ProbeTemplateCreate } from '../types'

const React = getReactRuntime()
const { useMemo, useState } = React

const methods: ProbeTemplateCreate['method'][] = ['GET', 'HEAD', 'POST']
const channels: NotificationRule['channel'][] = ['slack', 'email', 'pagerduty', 'webhook']
const thresholds: NotificationRule['threshold'][] = ['breach', 'always', 'recovery']

const formDefaults: ProbeTemplateCreate = {
  name: '',
  url: 'https://example.com/healthz',
  method: 'GET',
  sla_ms: 500,
  interval_seconds: 300,
  notification_rules: [],
  tags: [],
}

export default function ProbeDesigner() {
  const { templates, createTemplate, removeTemplate, loading, error } = useProbeTemplates()
  const [formState, setFormState] = useState(formDefaults)
  const [status, setStatus] = useState<string | null>(null)

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [templates],
  )

  const handleSubmit = async (event: any) => {
    event.preventDefault()
    setStatus(null)
    try {
      const payload: ProbeTemplateCreate = {
        ...formState,
        notification_rules: formState.notification_rules?.filter((rule) => rule.target.trim().length > 0),
        tags: formState.tags?.filter(Boolean) ?? [],
      }
      await createTemplate(payload)
      setFormState(formDefaults)
      setStatus('Probe template created')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to create template')
    }
  }

  const handleRuleChange = (index: number, key: keyof NotificationRule, value: string) => {
    setFormState((prev) => {
      const rules = [...(prev.notification_rules ?? [])]
      const current = rules[index] ?? { channel: 'slack', target: '', threshold: 'breach' }
      rules[index] = { ...current, [key]: value }
      return { ...prev, notification_rules: rules }
    })
  }

  const addRule = () => {
    setFormState((prev) => ({
      ...prev,
      notification_rules: [...(prev.notification_rules ?? []), { channel: 'slack', target: '', threshold: 'breach' }],
    }))
  }

  const removeRule = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      notification_rules: (prev.notification_rules ?? []).filter((_, idx) => idx !== index),
    }))
  }

  const updateTag = (index: number, value: string) => {
    setFormState((prev) => {
      const tags = [...(prev.tags ?? [])]
      tags[index] = value
      return { ...prev, tags }
    })
  }

  const addTag = () => {
    setFormState((prev) => ({ ...prev, tags: [...(prev.tags ?? []), ''] }))
  }

  const removeTag = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      tags: (prev.tags ?? []).filter((_, idx) => idx !== index),
    }))
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section className="tk-card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
        <header>
          <h3 style={{ margin: 0 }}>Probe Designer</h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
            Model SLAs, tags, and notification policies before releasing synthetic probes.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label className="tk-field-label">Name</label>
            <input
              className="tk-input"
              required
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div>
            <label className="tk-field-label">URL</label>
            <input
              className="tk-input"
              required
              type="url"
              value={formState.url}
              onChange={(event) => setFormState((prev) => ({ ...prev, url: event.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label className="tk-field-label" style={{ flex: '1 0 200px' }}>
              Method
              <select
                className="tk-select"
                value={formState.method}
                onChange={(event) => setFormState((prev) => ({ ...prev, method: event.target.value as typeof prev.method }))}
              >
                {methods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>

            <label className="tk-field-label" style={{ flex: '1 0 200px' }}>
              SLA (ms)
              <input
                className="tk-input"
                required
                type="number"
                min={10}
                value={formState.sla_ms}
                onChange={(event) => setFormState((prev) => ({ ...prev, sla_ms: Number(event.target.value) }))}
              />
            </label>

            <label className="tk-field-label" style={{ flex: '1 0 200px' }}>
              Interval (seconds)
              <input
                className="tk-input"
                type="number"
                min={30}
                value={formState.interval_seconds ?? 300}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, interval_seconds: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <div>
            <label className="tk-field-label" style={{ marginBottom: '0.3rem' }}>Notification Rules</label>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {(formState.notification_rules ?? []).map((rule, index) => (
                <div
                  key={index}
                  style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr)) auto' }}
                >
                  <select
                    className="tk-select"
                    value={rule.channel}
                    onChange={(event) => handleRuleChange(index, 'channel', event.target.value)}
                  >
                    {channels.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                  <input
                    className="tk-input"
                    placeholder="Target"
                    value={rule.target}
                    onChange={(event) => handleRuleChange(index, 'target', event.target.value)}
                  />
                  <select
                    className="tk-select"
                    value={rule.threshold}
                    onChange={(event) => handleRuleChange(index, 'threshold', event.target.value)}
                  >
                    {thresholds.map((threshold) => (
                      <option key={threshold} value={threshold}>
                        {threshold}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="tk-button" onClick={() => removeRule(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="tk-button" onClick={addRule}>
                Add rule
              </button>
            </div>
          </div>

          <div>
            <label className="tk-field-label" style={{ marginBottom: '0.3rem' }}>Tags</label>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {(formState.tags ?? []).map((tag, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="tk-input"
                    placeholder="service:web"
                    value={tag}
                    onChange={(event) => updateTag(index, event.target.value)}
                  />
                  <button type="button" className="tk-button" onClick={() => removeTag(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="tk-button" onClick={addTag}>
                Add tag
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="submit" className="tk-button tk-button--primary" disabled={loading}>
              Create template
            </button>
            {status && <span style={{ color: 'var(--color-text-secondary)' }}>{status}</span>}
            {error && <span style={{ color: 'var(--color-status-error)' }}>{error}</span>}
          </div>
        </form>
      </section>

      <section className="tk-card" style={{ padding: '1.25rem' }}>
        <header style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Template Catalog</h3>
        </header>
        <div style={{ overflowX: 'auto' }}>
          <table className="tk-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>SLA (ms)</th>
                <th>Interval</th>
                <th>Tags</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedTemplates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td style={{ maxWidth: 240, wordBreak: 'break-all' }}>{template.url}</td>
                  <td>{template.sla_ms}</td>
                  <td>{template.interval_seconds}s</td>
                  <td>{template.tags.join(', ')}</td>
                  <td>{new Date(template.updated_at).toLocaleString()}</td>
                  <td>
                    <button className="tk-button" type="button" onClick={() => removeTemplate(template.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {sortedTemplates.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>
                    {loading ? 'Loading templates…' : 'No templates captured yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
