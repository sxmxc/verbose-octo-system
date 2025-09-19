import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'

interface ProviderConfig {
  name: string
  type: string
  enabled?: boolean
  display_name?: string
  [key: string]: unknown
}

const containerStyle: React.CSSProperties = {
  display: 'grid',
  gap: '1.5rem',
  background: 'var(--color-surface)',
  borderRadius: 12,
  padding: '2rem',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--color-shadow)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 220,
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  padding: '0.75rem 1rem',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '0.95rem',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface-alt, #fff)',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.55rem 0.9rem',
  borderRadius: 8,
  border: '1px solid transparent',
  background: 'var(--color-sidebar-button-bg)',
  color: 'var(--color-sidebar-button-text)',
  cursor: 'pointer',
  fontWeight: 600,
}

export default function AuthSettingsPage() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await apiFetch<{ providers: ProviderConfig[] }>('/admin/settings/providers')
      setConfigs(response.providers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const currentConfig = useMemo(() => configs.find((config) => config.name === selectedName) || null, [configs, selectedName])

  const openEditor = (config: ProviderConfig | null) => {
    if (config) {
      setSelectedName(config.name)
      setEditorValue(JSON.stringify(config, null, 2))
    } else {
      setSelectedName(null)
      setEditorValue(
        JSON.stringify(
          {
            name: '',
            type: 'oidc',
            enabled: true,
          },
          null,
          2
        )
      )
    }
    setMessage(null)
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = JSON.parse(editorValue) as ProviderConfig
      if (!payload.name || !payload.type) {
        throw new Error('Provider configuration must include "name" and "type" fields.')
      }
      await apiFetch('/admin/settings/providers', {
        method: 'POST',
        body: payload,
      })
      setMessage(`Saved provider configuration for ${payload.name}.`)
      await loadProviders()
      setSelectedName(payload.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Remove provider “${name}”? Existing user identities will remain linked.`)) {
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await apiFetch(`/admin/settings/providers/${name}`, { method: 'DELETE', skipJson: true })
      setMessage(`Removed provider ${name}.`)
      setSelectedName(null)
      setEditorValue('')
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={containerStyle}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MaterialIcon name="security" /> Authentication providers
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Enable, disable, or configure external identity providers. Changes take effect immediately for new sessions.
        </p>
      </header>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading provider configurations…</p>
      ) : configs.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>No providers stored in the database. Use “Add provider” to create one.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {configs.map((config) => (
            <button
              key={config.name}
              type="button"
              onClick={() => openEditor(config)}
              style={{
                ...buttonStyle,
                justifyContent: 'space-between',
                background: selectedName === config.name ? 'var(--color-sidebar-button-active-bg)' : 'var(--color-sidebar-button-bg)',
                color: 'var(--color-sidebar-button-text)',
                borderColor: selectedName === config.name ? 'var(--color-outline)' : 'var(--color-border)',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <strong>{config.display_name || config.name}</strong>
                <small style={{ fontSize: '0.75rem', opacity: 0.75 }}>Type: {config.type} · {config.enabled === false ? 'Disabled' : 'Enabled'}</small>
              </span>
              <MaterialIcon name="chevron_right" />
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" style={buttonStyle} onClick={() => openEditor(null)}>
          <MaterialIcon name="add" /> Add provider
        </button>
        <button type="button" style={{ ...buttonStyle, borderColor: 'var(--color-border)' }} onClick={loadProviders} disabled={saving}>
          <MaterialIcon name="refresh" /> Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--color-danger-border)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: 'var(--color-danger-text, #b91c1c)',
            background: 'var(--color-danger-bg, rgba(248,113,113,0.12))',
          }}
        >
          {error}
        </div>
      )}

      {message && !error && (
        <div
          style={{
            border: '1px solid var(--color-success-border, #4ade80)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: 'var(--color-success-text, #15803d)',
            background: 'var(--color-success-bg, rgba(134, 239, 172, 0.15))',
          }}
        >
          {message}
        </div>
      )}

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Configuration</h3>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Edit the JSON definition for the selected provider. At minimum provide <code>name</code>, <code>type</code>, and any provider-specific
          settings (client IDs, secrets, LDAP connection parameters).
        </p>
        <textarea
          value={editorValue}
          onChange={(event) => setEditorValue(event.target.value)}
          placeholder="Select a provider or add a new one to begin editing."
          style={textareaStyle}
        />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" style={buttonStyle} onClick={handleSave} disabled={saving || !editorValue.trim()}>
            <MaterialIcon name="save" /> Save provider
          </button>
          {currentConfig && (
            <button
              type="button"
              onClick={() => handleDelete(currentConfig.name)}
              style={{
                ...buttonStyle,
                background: 'var(--color-danger-bg, rgba(248,113,113,0.12))',
                color: 'var(--color-danger-text, #b91c1c)',
                borderColor: 'var(--color-danger-border, #f87171)',
              }}
              disabled={saving}
            >
              <MaterialIcon name="delete" /> Delete provider
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
