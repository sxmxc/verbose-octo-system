import { getReactRuntime } from '../runtime'
import { useProbeTemplates } from '../hooks/useProbeTemplates'
import type { NotificationRule, ProbeTemplate, ProbeTemplateCreate } from '../types'
import { filterProbeTemplates } from './filterProbeTemplates'

const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

const methods: Required<ProbeTemplateCreate>['method'][] = ['GET', 'HEAD', 'POST']
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

type FormMode = 'create' | 'edit'

function toFormState(template: ProbeTemplate): ProbeTemplateCreate {
  return {
    name: template.name,
    description: template.description ?? undefined,
    url: template.url,
    method: template.method,
    sla_ms: template.sla_ms,
    interval_seconds: template.interval_seconds,
    notification_rules: template.notification_rules.map((rule) => ({ ...rule })),
    tags: [...template.tags],
  }
}

type TemplateFiltersProps = {
  searchText: string
  onSearchChange: (value: string) => void
  availableTags: string[]
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  onClear: () => void
}

function TemplateFilters({
  searchText,
  onSearchChange,
  availableTags,
  selectedTags,
  onToggleTag,
  onClear,
}: TemplateFiltersProps) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label className="tk-field-label" style={{ display: 'grid', gap: '0.35rem' }}>
        Search
        <input
          className="tk-input"
          placeholder="Filter by name or URL"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      {availableTags.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="tk-field-label">Tags</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {availableTags.map((tag) => {
              const selected = selectedTags.includes(tag)
              const className = selected ? 'tk-button tk-button--primary' : 'tk-button'
              return (
                <button
                  key={tag}
                  type="button"
                  className={className}
                  onClick={() => onToggleTag(tag)}
                  aria-pressed={selected}
                >
                  {tag}
                </button>
              )
            })}
            {selectedTags.length > 0 && (
              <button type="button" className="tk-button" onClick={onClear}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProbeDesigner() {
  const {
    templates,
    templatesById,
    createTemplate,
    updateTemplate,
    removeTemplate,
    refresh,
    loading,
    error,
  } = useProbeTemplates()

  const [formState, setFormState] = useState(formDefaults)
  const [status, setStatus] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    if (!activeTemplateId) return
    const template = templatesById.get(activeTemplateId)
    if (!template) return
    setFormState(toFormState(template))
  }, [activeTemplateId, templatesById])

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [templates],
  )

  const { availableTags, filteredTemplates } = useMemo(
    () =>
      filterProbeTemplates(sortedTemplates, {
        searchText,
        selectedTags,
      }),
    [sortedTemplates, searchText, selectedTags],
  )

  const activeTemplateName = activeTemplateId ? templatesById.get(activeTemplateId)?.name ?? null : null

  const handleSubmit = async (event: any) => {
    event.preventDefault()
    setStatus(null)
    const payload: ProbeTemplateCreate = {
      ...formState,
      notification_rules: formState.notification_rules?.filter((rule) => rule.target.trim().length > 0),
      tags: formState.tags?.filter((tag) => tag.trim().length > 0) ?? [],
    }

    try {
      if (formMode === 'edit' && activeTemplateId) {
        await updateTemplate(activeTemplateId, payload)
        setStatus('Probe template updated')
      } else {
        await createTemplate(payload)
        setStatus('Probe template created')
      }
      setFormState(formDefaults)
      if (formMode === 'edit') {
        setFormMode('create')
        setActiveTemplateId(null)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save template')
    }
  }

  const handleReset = () => {
    setFormState(formDefaults)
    setFormMode('create')
    setActiveTemplateId(null)
    setStatus(null)
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

  const beginEdit = (templateId: string) => {
    setActiveTemplateId(templateId)
    setFormMode('edit')
    setStatus(null)
  }

  const beginClone = (template: ProbeTemplate) => {
    const cloned = toFormState(template)
    cloned.name = `${template.name} copy`
    setFormState(cloned)
    setFormMode('create')
    setActiveTemplateId(null)
    setStatus('Cloning template — adjust fields before saving')
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  return (
    <div className="tk-card" style={{ padding: '1.5rem', display: 'grid', gap: '1.5rem' }}>
      <header>
        <h3 style={{ margin: 0 }}>Probe Designer</h3>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)' }}>
          Model SLAs, tags, and notification policies before releasing synthetic probes.
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            flex: '1 1 320px',
            maxWidth: 480,
            display: 'grid',
            gap: '0.75rem',
            paddingRight: '0.5rem',
          }}
        >
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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="tk-button tk-button--primary" disabled={loading}>
              {formMode === 'edit' ? 'Update template' : 'Create template'}
            </button>
            <button type="button" className="tk-button" onClick={handleReset}>
              {formMode === 'edit' ? 'Cancel edit' : 'Reset'}
            </button>
            {loading && <span style={{ color: 'var(--color-text-secondary)' }}>Saving…</span>}
          </div>

          <div style={{ display: 'grid', gap: '0.25rem' }}>
            {formMode === 'edit' && activeTemplateName && (
              <span style={{ color: 'var(--color-accent)' }}>
                Editing “{activeTemplateName}” — submit to apply changes or cancel to discard.
              </span>
            )}
            {status && <span style={{ color: 'var(--color-text-secondary)' }}>{status}</span>}
            {error && <span style={{ color: 'var(--color-status-error)' }}>{error}</span>}
          </div>
        </form>

        <section style={{ flex: '2 1 440px', minWidth: 320, display: 'grid', gap: '1rem' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Template Catalog</h3>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
                Filter templates, edit in place, or clone successful probes.
              </p>
            </div>
            <button className="tk-button" type="button" onClick={() => refresh()} disabled={loading}>
              Refresh
            </button>
          </header>

          <TemplateFilters
            searchText={searchText}
            onSearchChange={setSearchText}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onClear={() => setSelectedTags([])}
          />

          <div style={{ overflowX: 'auto' }}>
            <table className="tk-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>SLA (ms)</th>
                  <th>Interval</th>
                  <th>Tags</th>
                  <th>Next run</th>
                  <th>Updated</th>
                  <th style={{ minWidth: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => {
                  const isEditing = formMode === 'edit' && activeTemplateId === template.id
                  return (
                    <tr key={template.id} style={isEditing ? { outline: '2px solid var(--color-accent)' } : undefined}>
                      <td>{template.name}</td>
                      <td style={{ maxWidth: 240, wordBreak: 'break-all' }}>{template.url}</td>
                      <td>{template.sla_ms}</td>
                      <td>{template.interval_seconds}s</td>
                      <td>{template.tags.join(', ')}</td>
                      <td>
                        {template.next_run_at
                          ? new Date(template.next_run_at).toLocaleString()
                          : 'Pending'}
                      </td>
                      <td>{new Date(template.updated_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button
                            className="tk-button"
                            type="button"
                            onClick={() => beginEdit(template.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="tk-button"
                            type="button"
                            onClick={() => beginClone(template)}
                          >
                            Clone
                          </button>
                          <button
                            className="tk-button"
                            type="button"
                            onClick={() => removeTemplate(template.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>
                      {loading
                        ? 'Loading templates…'
                        : searchText || selectedTags.length > 0
                          ? 'No templates match the current filters.'
                          : 'No templates captured yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

