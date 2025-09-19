import type { CSSProperties, ReactNode } from 'react'

import { apiFetch, getReactRuntime } from '../runtime'
import type {
  Job,
  ZabbixDbScript,
  ZabbixDbScriptExecutionPreview,
  ZabbixDbScriptExecutionResponse,
} from './types'
import { useZabbixInstances } from './hooks'


const React = getReactRuntime()
const { useEffect, useMemo, useState } = React

const iconStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

const sectionStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '1.25rem',
  background: 'var(--color-surface-alt)',
  display: 'grid',
  gap: '1rem',
}

const previewStyle: CSSProperties = {
  background: 'var(--color-surface)',
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontFamily: 'Source Code Pro, monospace',
  marginTop: '0.4rem',
  overflowX: 'auto',
}

const dangerSwatch: Record<ZabbixDbScript['danger_level'], string> = {
  info: 'var(--color-tag-bg)',
  warning: 'rgba(250, 204, 21, 0.22)',
  danger: 'rgba(239, 68, 68, 0.25)',
}


type ScriptsState = {
  loading: boolean
  error: string | null
  scripts: ZabbixDbScript[]
}


type ExecutionState = {
  busy: boolean
  feedback: string | null
  lastJob: Job | null
  preview: ZabbixDbScriptExecutionPreview | null
}


type ScriptExecutePayload = {
  inputs: Record<string, string>
  dry_run: boolean
}


export default function ZabbixDbScriptsPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading: instancesLoading, error: instancesError } =
    useZabbixInstances()

  const [scriptsState, setScriptsState] = useState<ScriptsState>({ loading: true, error: null, scripts: [] })
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [executionState, setExecutionState] = useState<ExecutionState>({
    busy: false,
    feedback: null,
    lastJob: null,
    preview: null,
  })

  useEffect(() => {
    let cancelled = false
    async function loadScripts() {
      setScriptsState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const scripts = await apiFetch<ZabbixDbScript[]>('/toolkits/zabbix/db-scripts')
        if (cancelled) return
        setScriptsState({ loading: false, error: null, scripts })
      } catch (err) {
        if (cancelled) return
        setScriptsState({ loading: false, error: err instanceof Error ? err.message : String(err), scripts: [] })
      }
    }

    loadScripts()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (scriptsState.loading || scriptsState.scripts.length === 0) {
      return
    }
    setSelectedKey((prev) => {
      if (prev && scriptsState.scripts.some((script) => script.key === prev)) {
        return prev
      }
      return scriptsState.scripts[0].key
    })
  }, [scriptsState.loading, scriptsState.scripts])

  const selectedScript = useMemo(
    () => scriptsState.scripts.find((script) => script.key === selectedKey) ?? null,
    [scriptsState.scripts, selectedKey],
  )

  useEffect(() => {
    if (!selectedScript) {
      setFormValues({})
      return
    }
    const defaults = Object.fromEntries(selectedScript.inputs.map((input) => [input.name, input.default ?? '']))
    setFormValues(defaults)
  }, [selectedScript])

  const updateFormValue = (name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!selectedScript) {
      return 'Select a script to continue.'
    }
    for (const input of selectedScript.inputs) {
      if (input.required && !formValues[input.name]) {
        return `Field \"${input.label}\" is required.`
      }
    }
    return null
  }

  const runScript = async (dryRun: boolean) => {
    if (!selectedInstance) {
      setExecutionState((prev) => ({ ...prev, feedback: 'Select an instance first.' }))
      return
    }
    const validationError = validateForm()
    if (validationError) {
      setExecutionState((prev) => ({ ...prev, feedback: validationError }))
      return
    }
    if (!selectedScript) {
      setExecutionState((prev) => ({ ...prev, feedback: 'Select a script to continue.' }))
      return
    }

    setExecutionState({ busy: true, feedback: null, lastJob: null, preview: null })
    try {
      const payload: ScriptExecutePayload = {
        inputs: formValues,
        dry_run: dryRun,
      }
      const response = await apiFetch<ZabbixDbScriptExecutionResponse>(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/db-scripts/${selectedScript.key}/execute`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      if (dryRun && response.preview) {
        setExecutionState({ busy: false, feedback: response.message ?? null, lastJob: null, preview: response.preview })
        return
      }
      if (response.job) {
        setExecutionState({ busy: false, feedback: response.message ?? `Job queued with id ${response.job.id}`, lastJob: response.job, preview: null })
        return
      }
      setExecutionState({ busy: false, feedback: response.message ?? 'Script executed.', lastJob: null, preview: response.preview ?? null })
    } catch (err) {
      setExecutionState({ busy: false, feedback: err instanceof Error ? err.message : String(err), lastJob: null, preview: null })
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      <section style={sectionStyle}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            playlist_add_check
          </span>
          Database scripts
        </h4>
        <p style={{ margin: '0.25rem 0 0.75rem', color: 'var(--color-text-secondary)' }}>
          Execute vetted SQL maintenance scripts against your Zabbix database. Always dry-run first when available.
        </p>

        {scriptsState.loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading script catalog…</p>}
        {scriptsState.error && <p style={{ color: 'var(--color-danger-border)' }}>{scriptsState.error}</p>}
        {instancesLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading instances…</p>}
        {instancesError && <p style={{ color: 'var(--color-danger-border)' }}>{instancesError}</p>}

        {instances.length === 0 && !instancesLoading && (
          <p style={{ color: 'var(--color-text-secondary)' }}>Define at least one instance under Administration.</p>
        )}

        {instances.length > 0 && scriptsState.scripts.length > 0 && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 340 }}>
              Target instance
              <select className="tk-input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {instances.map((instance) => (
                  <option value={instance.id} key={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label className="tk-label" style={{ display: 'grid', gap: '0.3rem' }}>
                Script
                <select
                  className="tk-input"
                  value={selectedKey}
                  onChange={(event) => setSelectedKey(event.target.value)}
                >
                  {scriptsState.scripts.map((script) => (
                    <option key={script.key} value={script.key}>
                      {script.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedScript && (
                <div
                  style={{
                    border: `1px solid var(--color-border)`,
                    borderRadius: 8,
                    padding: '0.85rem 1rem',
                    background: 'var(--color-surface)',
                    display: 'grid',
                    gap: '0.35rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{selectedScript.name}</strong>
                    <span
                      className="tk-tag"
                      style={{
                        background: dangerSwatch[selectedScript.danger_level],
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {selectedScript.danger_level.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{selectedScript.description}</span>
                  {selectedScript.documentation && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>{selectedScript.documentation}</span>
                  )}
                </div>
              )}

              {selectedScript && (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {selectedScript.inputs.map((input) => (
                    <Field key={input.name} label={input.label} required={input.required} helpText={input.help_text}>
                      {renderInput(input, formValues[input.name] ?? '', updateFormValue)}
                    </Field>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="tk-button" disabled={executionState.busy} onClick={() => runScript(true)}>
                  <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                    visibility
                  </span>
                  Dry run
                </button>
                <button type="button" className="tk-button tk-button--primary" disabled={executionState.busy} onClick={() => runScript(false)}>
                  <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                    play_circle
                  </span>
                  Execute script
                </button>
              </div>

              {executionState.feedback && (
                <p style={{ color: 'var(--color-text-secondary)' }}>{executionState.feedback}</p>
              )}
              {executionState.lastJob && (
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Job queued with id {executionState.lastJob.id} — monitor progress in Jobs.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {executionState.preview && (
        <section style={sectionStyle}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              task
            </span>
            Dry run summary
          </h4>
          <p style={{ color: 'var(--color-text-secondary)' }}>{executionState.preview.summary}</p>
          {executionState.preview.statements.length > 0 && (
            <pre style={previewStyle}>{executionState.preview.statements.join('\n')}</pre>
          )}
        </section>
      )}
    </div>
  )
}


function Field({
  label,
  required,
  helpText,
  children,
}: {
  label: string
  required?: boolean
  helpText?: string
  children: ReactNode
}) {
  return (
    <label className="tk-label" style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
      {helpText && <small style={{ color: 'var(--color-text-secondary)' }}>{helpText}</small>}
    </label>
  )
}


function renderInput(
  input: ZabbixDbScript['inputs'][number],
  value: string,
  update: (name: string, next: string) => void,
): ReactNode {
  if (input.type === 'textarea') {
    return (
      <textarea
        className="tk-input"
        rows={input.placeholder ? 4 : 3}
        placeholder={input.placeholder}
        value={value}
        onChange={(event) => update(input.name, event.target.value)}
      />
    )
  }

  if (input.type === 'select' && input.options) {
    return (
      <select
        className="tk-input"
        value={value}
        onChange={(event) => update(input.name, event.target.value)}
      >
        <option value="">Select…</option>
        {input.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      className="tk-input"
      placeholder={input.placeholder}
      value={value}
      onChange={(event) => update(input.name, event.target.value)}
    />
  )
}
