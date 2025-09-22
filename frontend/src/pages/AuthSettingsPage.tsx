import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../api'
import { MaterialIcon } from '../components/MaterialIcon'
import { Skeleton } from '../components/Skeleton'

type ProviderType = 'local' | 'oidc' | 'ldap' | 'active_directory' | string
type VaultSecretMode = 'value' | 'vault-existing' | 'vault-new'

interface ProviderConfig {
  name: string
  type: string
  enabled?: boolean
  display_name?: string
  default_roles?: string[]
  [key: string]: unknown
}

interface VaultSecretRef {
  mount?: string
  path?: string
  key?: string
  engine?: string
  version?: number
}

interface VaultSecretFormState {
  mount: string
  path: string
  key: string
  engine: 'kv-v2' | 'kv-v1'
  version: string
}

interface OidcMetadataInfo {
  issuer?: string
  authorization_endpoint?: string
  token_endpoint?: string
  end_session_endpoint?: string
}

interface BaseFormState {
  name: string
  displayName: string
  enabled: boolean
  defaultRolesText: string
}

interface OidcFormState {
  discoveryUrl: string
  clientId: string
  secretMode: VaultSecretMode
  clientSecretInput: string
  clientSecretExisting?: string
  clientSecretVault: VaultSecretFormState
  clientSecretNewValue: string
  redirectBaseUrl: string
  scopesText: string
  prompt: string
  responseType: string
  audience: string
  groupClaim: string
  claimMappingsText: string
  roleMappingsText: string
  usePkce: boolean
}

interface LdapFormState {
  serverUri: string
  bindDn: string
  secretMode: VaultSecretMode
  bindPasswordInput: string
  bindPasswordExisting?: string
  bindPasswordVault: VaultSecretFormState
  bindPasswordNewValue: string
  userDnTemplate: string
  userSearchBase: string
  userFilter: string
  startTls: boolean
  attributesText: string
  groupSearchBase: string
  groupFilter: string
  groupMemberAttr: string
  roleMappingsText: string
  defaultDomain?: string
}

type ProviderFormState =
  | {
      kind: 'oidc'
      base: BaseFormState
      isNew: boolean
      extrasJson: string
      oidc: OidcFormState
    }
  | {
      kind: 'ldap'
      base: BaseFormState
      isNew: boolean
      extrasJson: string
      ldap: LdapFormState
    }
  | {
      kind: 'active_directory'
      base: BaseFormState
      isNew: boolean
      extrasJson: string
      ldap: LdapFormState
    }
  | {
      kind: 'local'
      base: BaseFormState
      isNew: boolean
      extrasJson: string
    }
  | {
      kind: 'unknown'
      base: BaseFormState
      isNew: boolean
      rawJson: string
      type: string
    }

type KnownProviderFormState = Extract<ProviderFormState, { kind: 'oidc' | 'ldap' | 'active_directory' | 'local' }>

const providerLabels: Record<string, string> = {
  oidc: 'OpenID Connect',
  ldap: 'LDAP',
  active_directory: 'Active Directory',
  local: 'Local Accounts',
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

const contentStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2rem',
  flexWrap: 'wrap',
}

const listPanelStyle: React.CSSProperties = {
  flex: '1 1 260px',
  maxWidth: 320,
  display: 'grid',
  gap: '0.75rem',
  alignContent: 'start',
}

const formPanelStyle: React.CSSProperties = {
  flex: '2 1 420px',
  minWidth: 320,
  display: 'grid',
  gap: '1rem',
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

const listButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  justifyContent: 'space-between',
  width: '100%',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt, #fff)',
  color: 'var(--color-text-primary)',
  fontSize: '0.95rem',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-mono, monospace)',
  minHeight: 160,
  resize: 'vertical',
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
}

const helpTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
}

const sectionBoxStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt, #fff)',
}

const advancedSummaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
}

const helperBoxStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
  padding: '0.75rem',
  borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: 'var(--color-surface-alt, #fff)',
}

export default function AuthSettingsPage() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [formState, setFormState] = useState<ProviderFormState | null>(null)
  const [newType, setNewType] = useState<ProviderType>('oidc')
  const defaultOrigin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), [])
  const [oidcMetadata, setOidcMetadata] = useState<OidcMetadataInfo | null>(null)
  const [oidcMetadataLoading, setOidcMetadataLoading] = useState(false)
  const [oidcMetadataError, setOidcMetadataError] = useState<string | null>(null)
  const [keycloakHelperOpen, setKeycloakHelperOpen] = useState(false)
  const [keycloakBaseUrl, setKeycloakBaseUrl] = useState('')
  const [keycloakRealm, setKeycloakRealm] = useState('')

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

  useEffect(() => {
    if (!formState || formState.kind !== 'oidc') {
      setOidcMetadata(null)
      setOidcMetadataError(null)
      setOidcMetadataLoading(false)
      setKeycloakHelperOpen(false)
      setKeycloakBaseUrl('')
      setKeycloakRealm('')
    }
  }, [formState])

  const currentConfig = useMemo(() => {
    if (!selectedName || selectedName === '__new__') {
      return null
    }
    return configs.find((config) => config.name === selectedName) || null
  }, [configs, selectedName])

  useEffect(() => {
    if (selectedName && selectedName !== '__new__') {
      const config = configs.find((item) => item.name === selectedName)
      if (config) {
        setFormState(parseProviderConfig(config))
      } else {
        setFormState(null)
      }
    }
  }, [configs, selectedName])

  const openExistingProvider = (config: ProviderConfig) => {
    setSelectedName(config.name)
    setFormState(parseProviderConfig(config))
    setMessage(null)
    setError(null)
  }

  const openNewProvider = (type: ProviderType) => {
    const next = createNewFormState(type)
    setSelectedName('__new__')
    setFormState(next)
    setMessage(null)
    setError(null)
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
      setFormState(null)
      await loadProviders()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!formState) {
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const pendingWrites = collectVaultWrites(formState)
      for (const write of pendingWrites) {
        await createVaultSecretViaApi(write)
      }

      const normalizedForm = normalizeFormAfterVaultWrites(formState)
      setFormState(normalizedForm)

      const payload = buildPayload(normalizedForm)
      await apiFetch('/admin/settings/providers', {
        method: 'POST',
        body: payload,
      })
      await loadProviders()
      setSelectedName(payload.name as string)
      setMessage(`Saved provider configuration for ${payload.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const updateBase = (field: keyof BaseFormState, value: string | boolean) => {
    setFormState((prev) => {
      if (!prev) {
        return prev
      }
      const nextBase: BaseFormState = {
        ...prev.base,
        [field]: value,
      }

      if (prev.kind === 'oidc') {
        let nextVault = prev.oidc.clientSecretVault
        if (field === 'name' && typeof value === 'string' && prev.oidc.secretMode === 'vault-new') {
          const defaults = suggestVaultLocation(value, 'client_secret')
          nextVault = {
            ...nextVault,
            path: nextVault.path || defaults.path,
            key: nextVault.key || defaults.key,
          }
        }
        return {
          ...prev,
          base: nextBase,
          oidc: {
            ...prev.oidc,
            clientSecretVault: nextVault,
          },
        }
      }

      if (prev.kind === 'ldap' || prev.kind === 'active_directory') {
        let nextVault = prev.ldap.bindPasswordVault
        if (field === 'name' && typeof value === 'string' && prev.ldap.secretMode === 'vault-new') {
          const defaults = suggestVaultLocation(value, 'bind_password')
          nextVault = {
            ...nextVault,
            path: nextVault.path || defaults.path,
            key: nextVault.key || defaults.key,
          }
        }
        return {
          ...prev,
          base: nextBase,
          ldap: {
            ...prev.ldap,
            bindPasswordVault: nextVault,
          },
        }
      }

      return {
        ...prev,
        base: nextBase,
      }
    })
  }

  const updateOidc = (update: Partial<OidcFormState>) => {
    setFormState((prev) => {
      if (!prev || prev.kind !== 'oidc') {
        return prev
      }
      return {
        ...prev,
        oidc: {
          ...prev.oidc,
          ...update,
        },
      }
    })
  }

  const changeOidcSecretMode = (mode: VaultSecretMode) => {
    setFormState((prev) => {
      if (!prev || prev.kind !== 'oidc') {
        return prev
      }
      const nextMode = mode
      const vaultDefaults = suggestVaultLocation(prev.base.name, 'client_secret')
      const nextVault = {
        ...prev.oidc.clientSecretVault,
        path:
          nextMode === 'vault-new' && !prev.oidc.clientSecretVault.path
            ? vaultDefaults.path
            : prev.oidc.clientSecretVault.path,
        key:
          nextMode === 'vault-new' && !prev.oidc.clientSecretVault.key
            ? vaultDefaults.key
            : prev.oidc.clientSecretVault.key || vaultDefaults.key,
      }
      return {
        ...prev,
        oidc: {
          ...prev.oidc,
          secretMode: nextMode,
          clientSecretInput: nextMode === 'value' ? prev.oidc.clientSecretInput : '',
          clientSecretVault: nextVault,
          clientSecretNewValue: '',
        },
      }
    })
  }

  const updateLdap = (update: Partial<LdapFormState>) => {
    setFormState((prev) => {
      if (!prev || (prev.kind !== 'ldap' && prev.kind !== 'active_directory')) {
        return prev
      }
      return {
        ...prev,
        ldap: {
          ...prev.ldap,
          ...update,
        },
      }
    })
  }

  const changeLdapSecretMode = (mode: VaultSecretMode) => {
    setFormState((prev) => {
      if (!prev || (prev.kind !== 'ldap' && prev.kind !== 'active_directory')) {
        return prev
      }
      const vaultDefaults = suggestVaultLocation(prev.base.name, 'bind_password')
      const nextVault = {
        ...prev.ldap.bindPasswordVault,
        path:
          mode === 'vault-new' && !prev.ldap.bindPasswordVault.path
            ? vaultDefaults.path
            : prev.ldap.bindPasswordVault.path,
        key:
          mode === 'vault-new' && !prev.ldap.bindPasswordVault.key
            ? vaultDefaults.key
            : prev.ldap.bindPasswordVault.key || vaultDefaults.key,
      }
      return {
        ...prev,
        ldap: {
          ...prev.ldap,
          secretMode: mode,
          bindPasswordInput: mode === 'value' ? prev.ldap.bindPasswordInput : '',
          bindPasswordVault: nextVault,
          bindPasswordNewValue: '',
        },
      }
    })
  }

  const computedOidcUrls = useMemo(() => {
    if (!formState || formState.kind !== 'oidc') {
      return null
    }
    const slug = sanitizeSlug(formState.base.name)
    const redirectBase = (formState.oidc.redirectBaseUrl || defaultOrigin || '').trim()
    if (!redirectBase) {
      return {
        callback: '',
        postLogout: '',
        base: '',
        slug,
      }
    }
    const normalizedBase = redirectBase.replace(/\/$/, '')
    return {
      callback: `${normalizedBase}/auth/sso/${slug}/callback`,
      postLogout: `${normalizedBase}/auth/sso/${slug}/logout`,
      base: normalizedBase,
      slug,
    }
  }, [formState, defaultOrigin])

  const importOidcMetadata = async (url: string) => {
    if (!formState || formState.kind !== 'oidc') {
      return
    }
    const trimmed = url.trim()
    if (!trimmed) {
      setOidcMetadataError('Enter a discovery URL first.')
      return
    }
    setOidcMetadataLoading(true)
    setOidcMetadataError(null)
    try {
      const response = await fetch(trimmed, { credentials: 'omit' })
      if (!response.ok) {
        throw new Error(`Failed to load metadata (${response.status})`)
      }
      const data = await response.json()
      const summary: OidcMetadataInfo = {
        issuer: typeof data.issuer === 'string' ? data.issuer : undefined,
        authorization_endpoint: typeof data.authorization_endpoint === 'string' ? data.authorization_endpoint : undefined,
        token_endpoint: typeof data.token_endpoint === 'string' ? data.token_endpoint : undefined,
        end_session_endpoint: typeof data.end_session_endpoint === 'string' ? data.end_session_endpoint : undefined,
      }
      setOidcMetadata(summary)
      setFormState((prev) => {
        if (!prev || prev.kind !== 'oidc') {
          return prev
        }
        return {
          ...prev,
          oidc: {
            ...prev.oidc,
            discoveryUrl: trimmed,
            audience: prev.oidc.audience || summary.issuer || prev.oidc.audience,
            redirectBaseUrl: prev.oidc.redirectBaseUrl || defaultOrigin,
          },
        }
      })
      setMessage(`Imported OIDC metadata from ${trimmed}`)
    } catch (err) {
      setOidcMetadata(null)
      setOidcMetadataError(err instanceof Error ? err.message : String(err))
    } finally {
      setOidcMetadataLoading(false)
    }
  }

  const handleDiscoveryImport = async () => {
    if (!formState || formState.kind !== 'oidc') {
      return
    }
    await importOidcMetadata(formState.oidc.discoveryUrl)
  }

  const handleKeycloakImport = async () => {
    if (!formState || formState.kind !== 'oidc') {
      return
    }
    const base = keycloakBaseUrl.trim().replace(/\/$/, '')
    const realm = keycloakRealm.trim()
    if (!base || !realm) {
      setOidcMetadataError('Provide Keycloak base URL and realm.')
      return
    }
    const discovery = `${base}/realms/${encodeURIComponent(realm)}/.well-known/openid-configuration`
    await importOidcMetadata(discovery)
    setKeycloakHelperOpen(false)
    if (!formState.oidc.groupClaim) {
      updateOidc({ groupClaim: 'groups' })
    }
  }

  const updateExtras = (value: string) => {
    setFormState((prev) => {
      if (!prev || prev.kind === 'unknown') {
        return prev
      }
      return {
        ...prev,
        extrasJson: value,
      }
    })
  }

  const updateRawJson = (value: string) => {
    setFormState((prev) => {
      if (!prev || prev.kind !== 'unknown') {
        return prev
      }
      return {
        ...prev,
        rawJson: value,
      }
    })
  }

  const renderVaultFields = (state: VaultSecretFormState, onChange: (patch: Partial<VaultSecretFormState>) => void, idPrefix: string) => (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={labelStyle} htmlFor={`${idPrefix}-mount`}>
        Vault mount (optional)
        <input
          id={`${idPrefix}-mount`}
          value={state.mount}
          onChange={(event) => onChange({ mount: event.target.value })}
          placeholder="e.g. sre"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle} htmlFor={`${idPrefix}-path`}>
        Vault path
        <input
          id={`${idPrefix}-path`}
          value={state.path}
          onChange={(event) => onChange({ path: event.target.value })}
          placeholder="auth/okta"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle} htmlFor={`${idPrefix}-key`}>
        Vault key
        <input
          id={`${idPrefix}-key`}
          value={state.key}
          onChange={(event) => onChange({ key: event.target.value })}
          placeholder="client_secret"
          style={inputStyle}
        />
      </label>
      <label style={labelStyle} htmlFor={`${idPrefix}-engine`}>
        Secrets engine
        <select
          id={`${idPrefix}-engine`}
          value={state.engine}
          onChange={(event) => onChange({ engine: event.target.value as VaultSecretFormState['engine'] })}
          style={inputStyle}
        >
          <option value="kv-v2">KV v2 (default)</option>
          <option value="kv-v1">KV v1</option>
        </select>
      </label>
      <label style={labelStyle} htmlFor={`${idPrefix}-version`}>
        Version (optional for KV v2)
        <input
          id={`${idPrefix}-version`}
          value={state.version}
          onChange={(event) => onChange({ version: event.target.value })}
          placeholder="latest"
          style={inputStyle}
        />
      </label>
    </div>
  )

  return (
    <div style={containerStyle}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MaterialIcon name="security" /> Authentication providers
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
          Enable, disable, or configure external identity providers. Each provider gets a tailored form—no more hand-editing JSON
          for the common types (OIDC, LDAP, Active Directory).
        </p>
      </header>

      <div style={contentStyle}>
        <aside style={listPanelStyle}>
          {loading ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`auth-skeleton-${index}`}
                  style={{
                    ...listButtonStyle,
                    display: 'grid',
                    gap: '0.5rem',
                    background: 'var(--color-sidebar-button-bg)',
                    border: '1px dashed var(--color-border)',
                    alignItems: 'start',
                  }}
                >
                  <Skeleton height="0.9rem" width="50%" />
                  <Skeleton height="0.7rem" width="70%" />
                </div>
              ))}
            </div>
          ) : configs.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No providers stored yet. Add one to get started.</p>
          ) : (
            configs.map((config) => (
              <button
                key={config.name}
                type="button"
                onClick={() => openExistingProvider(config)}
                style={{
                  ...listButtonStyle,
                  background:
                    selectedName === config.name
                      ? 'var(--color-sidebar-button-active-bg)'
                      : 'var(--color-sidebar-button-bg)',
                  color: 'var(--color-sidebar-button-text)',
                  borderColor: selectedName === config.name ? 'var(--color-outline)' : 'var(--color-border)',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <strong>{(config.display_name as string) || config.name}</strong>
                  <small style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                    Type: {providerLabels[config.type] || config.type} · {config.enabled === false ? 'Disabled' : 'Enabled'}
                  </small>
                </span>
                <MaterialIcon name="chevron_right" />
              </button>
            ))
          )}

          <div
            style={{
              display: 'grid',
              gap: '0.6rem',
              borderTop: '1px solid var(--color-border)',
              paddingTop: '0.75rem',
              alignSelf: 'start',
            }}
          >
            <label style={labelStyle}>
              Provider type
              <select value={newType} onChange={(event) => setNewType(event.target.value)} style={inputStyle}>
                <option value="oidc">OpenID Connect</option>
                <option value="ldap">LDAP</option>
                <option value="active_directory">Active Directory</option>
                <option value="local">Local Accounts</option>
              </select>
            </label>
            <button type="button" style={buttonStyle} onClick={() => openNewProvider(newType)}>
              <MaterialIcon name="add" /> Add provider
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, borderColor: 'var(--color-border)' }}
              onClick={loadProviders}
              disabled={saving}
            >
              <MaterialIcon name="refresh" /> Refresh
            </button>
          </div>
        </aside>

        <section style={formPanelStyle}>
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
                background: 'var(--color-success-bg, rgba(134,239,172,0.15))',
              }}
            >
              {message}
            </div>
          )}

          {!formState ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Select a provider from the list or add a new one to configure it.
            </p>
          ) : formState.kind === 'unknown' ? (
            <div style={sectionBoxStyle}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Manual configuration</h3>
              <p style={helpTextStyle}>
                This provider type is not recognised by the UI forms. Edit the JSON payload directly. Ensure it contains <code>name</code>,
                <code>type</code>, and any provider-specific settings.
              </p>
              <textarea
                style={{ ...textareaStyle, minHeight: 260 }}
                value={formState.rawJson}
                onChange={(event) => updateRawJson(event.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={sectionBoxStyle}>
                {formState.isNew ? (
                  <label style={labelStyle}>
                    Provider type
                    <select
                      value={formState.kind}
                      onChange={(event) => {
                        const nextType = event.target.value as ProviderType
                        setFormState((prev) => {
                          if (!prev) {
                            return prev
                          }
                          const base = prev.base
                          const nextState = createNewFormState(nextType)
                          return {
                            ...nextState,
                            base: {
                              ...nextState.base,
                              name: base.name,
                              displayName: base.displayName,
                              enabled: base.enabled,
                              defaultRolesText: base.defaultRolesText,
                            },
                          }
                        })
                      }}
                      style={inputStyle}
                    >
                      <option value="oidc">OpenID Connect</option>
                      <option value="ldap">LDAP</option>
                      <option value="active_directory">Active Directory</option>
                      <option value="local">Local Accounts</option>
                    </select>
                  </label>
                ) : (
                  <p style={{ ...helpTextStyle, fontWeight: 600 }}>
                    Type: {providerLabels[formState.kind] || formState.kind}
                  </p>
                )}

                <label style={labelStyle}>
                  Provider name
                  <input
                    value={formState.base.name}
                    onChange={(event) => updateBase('name', event.target.value)}
                    placeholder="unique identifier (e.g. okta)"
                    style={inputStyle}
                    disabled={!formState.isNew}
                  />
                  <p style={helpTextStyle}>This slug is referenced in redirect URLs and must be unique.</p>
                </label>

                <label style={labelStyle}>
                  Display name
                  <input
                    value={formState.base.displayName}
                    onChange={(event) => updateBase('displayName', event.target.value)}
                    placeholder="Label shown on the login screen"
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formState.base.enabled}
                    onChange={(event) => updateBase('enabled', event.target.checked)}
                  />
                  Enabled
                </label>

                <label style={labelStyle}>
                  Default roles (comma or space separated)
                  <input
                    value={formState.base.defaultRolesText}
                    onChange={(event) => updateBase('defaultRolesText', event.target.value)}
                    placeholder="toolkit.user, toolkit.curator"
                    style={inputStyle}
                  />
                </label>
              </div>

              {(formState.kind === 'oidc' && (
                <div style={sectionBoxStyle}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>OpenID Connect settings</h3>

                  <div style={helperBoxStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={{ ...buttonStyle, paddingInline: '0.9rem' }}
                        onClick={handleDiscoveryImport}
                        disabled={oidcMetadataLoading}
                      >
                        <MaterialIcon name="cloud_download" /> Load metadata
                      </button>
                      <button
                        type="button"
                        style={{ ...buttonStyle, paddingInline: '0.9rem' }}
                        onClick={() => setKeycloakHelperOpen((open) => !open)}
                        disabled={oidcMetadataLoading}
                      >
                        <MaterialIcon name="account_tree" /> Keycloak helper
                      </button>
                    </div>
                    {oidcMetadataLoading && (
                      <p style={helpTextStyle}>Fetching discovery document…</p>
                    )}
                    {oidcMetadataError && (
                      <p style={{ ...helpTextStyle, color: 'var(--color-danger-text, #b91c1c)' }}>{oidcMetadataError}</p>
                    )}
                    {keycloakHelperOpen && (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <label style={labelStyle}>
                          Keycloak base URL
                          <input
                            value={keycloakBaseUrl}
                            onChange={(event) => setKeycloakBaseUrl(event.target.value)}
                            placeholder="https://keycloak.example.com"
                            style={inputStyle}
                          />
                        </label>
                        <label style={labelStyle}>
                          Realm
                          <input
                            value={keycloakRealm}
                            onChange={(event) => setKeycloakRealm(event.target.value)}
                            placeholder="sre-toolbox"
                            style={inputStyle}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            style={{ ...buttonStyle, paddingInline: '0.9rem' }}
                            onClick={handleKeycloakImport}
                            disabled={oidcMetadataLoading}
                          >
                            <MaterialIcon name="file_download" /> Import from Keycloak
                          </button>
                          <button
                            type="button"
                            style={{ ...buttonStyle, borderColor: 'var(--color-border)' }}
                            onClick={() => {
                              setKeycloakHelperOpen(false)
                              setKeycloakBaseUrl('')
                              setKeycloakRealm('')
                            }}
                          >
                            <MaterialIcon name="close" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {oidcMetadata && (
                      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        <div>
                          Issuer: <code>{oidcMetadata.issuer}</code>
                        </div>
                        {oidcMetadata.authorization_endpoint && (
                          <div>
                            Authorization endpoint: <code>{oidcMetadata.authorization_endpoint}</code>
                          </div>
                        )}
                        {oidcMetadata.token_endpoint && (
                          <div>
                            Token endpoint: <code>{oidcMetadata.token_endpoint}</code>
                          </div>
                        )}
                        {oidcMetadata.end_session_endpoint && (
                          <div>
                            End session endpoint: <code>{oidcMetadata.end_session_endpoint}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <label style={labelStyle}>
                    Discovery URL
                    <input
                      value={formState.oidc.discoveryUrl}
                      onChange={(event) => updateOidc({ discoveryUrl: event.target.value })}
                      placeholder="https://…/.well-known/openid-configuration"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Client ID
                    <input
                      value={formState.oidc.clientId}
                      onChange={(event) => updateOidc({ clientId: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Client secret source
                    <select
                      value={formState.oidc.secretMode}
                      onChange={(event) => changeOidcSecretMode(event.target.value as VaultSecretMode)}
                      style={inputStyle}
                    >
                      <option value="value">Store plaintext secret (development only)</option>
                      <option value="vault-existing">Reference existing Vault secret</option>
                      <option value="vault-new">Create new Vault secret</option>
                    </select>
                  </label>

                  {formState.oidc.secretMode === 'value' ? (
                    <label style={labelStyle}>
                      Client secret
                      <input
                        type="password"
                        value={formState.oidc.clientSecretInput}
                        onChange={(event) => updateOidc({ clientSecretInput: event.target.value })}
                        placeholder={formState.oidc.clientSecretExisting ? 'Stored — leave blank to keep current secret' : ''}
                        style={inputStyle}
                      />
                    </label>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {renderVaultFields(formState.oidc.clientSecretVault, (patch) => updateOidc({
                        clientSecretVault: {
                          ...formState.oidc.clientSecretVault,
                          ...patch,
                        },
                      }), 'oidc-secret')}
                      {formState.oidc.secretMode === 'vault-new' && (
                        <label style={labelStyle}>
                          Secret value
                          <input
                            type="password"
                            value={formState.oidc.clientSecretNewValue}
                            onChange={(event) => updateOidc({ clientSecretNewValue: event.target.value })}
                            placeholder="Value to store in Vault"
                            style={inputStyle}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  <label style={labelStyle}>
                    Redirect base URL (optional)
                    <input
                      value={formState.oidc.redirectBaseUrl}
                      onChange={(event) => updateOidc({ redirectBaseUrl: event.target.value })}
                      placeholder="http://localhost:5173"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Scopes
                    <input
                      value={formState.oidc.scopesText}
                      onChange={(event) => updateOidc({ scopesText: event.target.value })}
                      placeholder="openid, profile, email"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Audience (optional)
                    <input
                      value={formState.oidc.audience}
                      onChange={(event) => updateOidc({ audience: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Prompt (optional)
                    <input
                      value={formState.oidc.prompt}
                      onChange={(event) => updateOidc({ prompt: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Group claim (optional)
                    <input
                      value={formState.oidc.groupClaim}
                      onChange={(event) => updateOidc({ groupClaim: event.target.value })}
                      placeholder="groups"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Claim mappings (JSON object)
                    <textarea
                      style={textareaStyle}
                      placeholder='{"username": "preferred_username"}'
                      value={formState.oidc.claimMappingsText}
                      onChange={(event) => updateOidc({ claimMappingsText: event.target.value })}
                    />
                  </label>

                  <label style={labelStyle}>
                    Role mappings (JSON object)
                    <textarea
                      style={textareaStyle}
                      placeholder='{"group": ["role"]}'
                      value={formState.oidc.roleMappingsText}
                      onChange={(event) => updateOidc({ roleMappingsText: event.target.value })}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={formState.oidc.usePkce}
                      onChange={(event) => updateOidc({ usePkce: event.target.checked })}
                    />
                    Use PKCE (recommended)
                  </label>

                  {computedOidcUrls && (
                    <div style={helperBoxStyle}>
                      <strong style={{ fontSize: '0.95rem' }}>Callback references</strong>
                      <label style={labelStyle}>
                        Login callback URL
                        <input
                          readOnly
                          value={computedOidcUrls.callback || 'Provide a provider name and redirect base URL to preview'}
                          style={{ ...inputStyle, cursor: 'text' }}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </label>
                      <label style={labelStyle}>
                        Post logout redirect URL
                        <input
                          readOnly
                          value={computedOidcUrls.postLogout || 'Provide a provider name and redirect base URL to preview'}
                          style={{ ...inputStyle, cursor: 'text' }}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )) || null}

              {(formState.kind === 'ldap' || formState.kind === 'active_directory') && (
                <div style={sectionBoxStyle}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {formState.kind === 'active_directory' ? 'Active Directory settings' : 'LDAP settings'}
                  </h3>

                  <label style={labelStyle}>
                    Server URI
                    <input
                      value={formState.ldap.serverUri}
                      onChange={(event) => updateLdap({ serverUri: event.target.value })}
                      placeholder="ldaps://ldap.example.com"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Bind DN (optional)
                    <input
                      value={formState.ldap.bindDn}
                      onChange={(event) => updateLdap({ bindDn: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Bind password source
                    <select
                      value={formState.ldap.secretMode}
                      onChange={(event) => changeLdapSecretMode(event.target.value as VaultSecretMode)}
                      style={inputStyle}
                    >
                      <option value="value">Store plaintext secret (development only)</option>
                      <option value="vault-existing">Reference existing Vault secret</option>
                      <option value="vault-new">Create new Vault secret</option>
                    </select>
                  </label>

                  {formState.ldap.secretMode === 'value' ? (
                    <label style={labelStyle}>
                      Bind password
                      <input
                        type="password"
                        value={formState.ldap.bindPasswordInput}
                        onChange={(event) => updateLdap({ bindPasswordInput: event.target.value })}
                        placeholder={formState.ldap.bindPasswordExisting ? 'Stored — leave blank to keep current secret' : ''}
                        style={inputStyle}
                      />
                    </label>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {renderVaultFields(formState.ldap.bindPasswordVault, (patch) => updateLdap({
                        bindPasswordVault: {
                          ...formState.ldap.bindPasswordVault,
                          ...patch,
                        },
                      }), 'ldap-secret')}
                      {formState.ldap.secretMode === 'vault-new' && (
                        <label style={labelStyle}>
                          Secret value
                          <input
                            type="password"
                            value={formState.ldap.bindPasswordNewValue}
                            onChange={(event) => updateLdap({ bindPasswordNewValue: event.target.value })}
                            placeholder="Value to store in Vault"
                            style={inputStyle}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  <label style={labelStyle}>
                    User DN template (optional)
                    <input
                      value={formState.ldap.userDnTemplate}
                      onChange={(event) => updateLdap({ userDnTemplate: event.target.value })}
                      placeholder="uid={username},ou=people,dc=example,dc=com"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    User search base (optional)
                    <input
                      value={formState.ldap.userSearchBase}
                      onChange={(event) => updateLdap({ userSearchBase: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    User filter (optional)
                    <input
                      value={formState.ldap.userFilter}
                      onChange={(event) => updateLdap({ userFilter: event.target.value })}
                      placeholder="(&(objectClass=person)(uid={username}))"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={formState.ldap.startTls}
                      onChange={(event) => updateLdap({ startTls: event.target.checked })}
                    />
                    Start TLS
                  </label>

                  <label style={labelStyle}>
                    Attribute mappings (JSON object)
                    <textarea
                      style={textareaStyle}
                      placeholder='{"username": "uid", "email": "mail", "display_name": "cn"}'
                      value={formState.ldap.attributesText}
                      onChange={(event) => updateLdap({ attributesText: event.target.value })}
                    />
                  </label>

                  <label style={labelStyle}>
                    Group search base (optional)
                    <input
                      value={formState.ldap.groupSearchBase}
                      onChange={(event) => updateLdap({ groupSearchBase: event.target.value })}
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Group filter (optional)
                    <input
                      value={formState.ldap.groupFilter}
                      onChange={(event) => updateLdap({ groupFilter: event.target.value })}
                      placeholder="(&(objectClass=groupOfNames)(member={user_dn}))"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Group member attribute
                    <input
                      value={formState.ldap.groupMemberAttr}
                      onChange={(event) => updateLdap({ groupMemberAttr: event.target.value })}
                      placeholder="memberOf"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Role mappings (JSON object)
                    <textarea
                      style={textareaStyle}
                      placeholder='{"cn=sre-admins,ou=groups,dc=example,dc=com": ["system.admin"]}'
                      value={formState.ldap.roleMappingsText}
                      onChange={(event) => updateLdap({ roleMappingsText: event.target.value })}
                    />
                  </label>

                  {formState.kind === 'active_directory' && (
                    <label style={labelStyle}>
                      Default domain (optional)
                      <input
                        value={formState.ldap.defaultDomain || ''}
                        onChange={(event) => updateLdap({ defaultDomain: event.target.value })}
                        placeholder="example.corp"
                        style={inputStyle}
                      />
                    </label>
                  )}
                </div>
              )}

              {formState.kind === 'local' && (
                <div style={sectionBoxStyle}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Local provider settings</h3>
                  <p style={helpTextStyle}>
                    The local provider supports username/password logins managed inside SRE Toolbox. There are no additional settings beyond
                    the defaults above. Use roles to control access.
                  </p>
                </div>
              )}

              {(() => {
                const knownForm = formState as KnownProviderFormState
                const extras = knownForm.extrasJson
                return (
                  <div style={sectionBoxStyle}>
                    <details open={extras.trim() !== '' && extras.trim() !== '{}'}>
                      <summary style={advancedSummaryStyle}>Advanced JSON overrides</summary>
                      <p style={helpTextStyle}>
                        Any additional configuration keys provided here are merged into the payload as-is. Use this for advanced provider
                        features not yet exposed via the form.
                      </p>
                      <textarea
                        style={{ ...textareaStyle, minHeight: 140 }}
                        value={extras}
                        onChange={(event) => updateExtras(event.target.value)}
                      />
                    </details>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...buttonStyle, paddingInline: '1.1rem' }}
                  onClick={handleSave}
                  disabled={saving || !formState.base.name.trim()}
                >
                  <MaterialIcon name="save" /> Save provider
                </button>
                {!formState.isNew && currentConfig && (
                  <button
                    type="button"
                    style={{ ...buttonStyle, borderColor: 'var(--color-border)' }}
                    onClick={() => setFormState(parseProviderConfig(currentConfig))}
                    disabled={saving}
                  >
                    <MaterialIcon name="undo" /> Reset changes
                  </button>
                )}
                {!formState.isNew && currentConfig && (
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
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function defaultVaultSecretFormState(): VaultSecretFormState {
  return {
    mount: '',
    path: '',
    key: '',
    engine: 'kv-v2',
    version: '',
  }
}

function parseVaultSecretRef(ref: unknown): VaultSecretFormState {
  const defaults = defaultVaultSecretFormState()
  if (!ref || typeof ref !== 'object') {
    return defaults
  }
  const value = ref as Record<string, unknown>
  return {
    mount: typeof value.mount === 'string' ? value.mount : '',
    path: typeof value.path === 'string' ? value.path : '',
    key: typeof value.key === 'string' ? value.key : '',
    engine: value.engine === 'kv-v1' ? 'kv-v1' : 'kv-v2',
    version: value.version !== undefined ? String(value.version) : '',
  }
}

function parseProviderConfig(config: ProviderConfig): ProviderFormState {
  const {
    name,
    type: rawType,
    display_name,
    enabled = true,
    default_roles = [],
    ...typeFields
  } = config

  const type = rawType as ProviderType
  const base: BaseFormState = {
    name,
    displayName: typeof display_name === 'string' ? display_name : '',
    enabled: enabled !== false,
    defaultRolesText: Array.isArray(default_roles) ? default_roles.join(', ') : '',
  }

  if (type === 'oidc') {
    const {
      discovery_url = '',
      client_id = '',
      client_secret,
      client_secret_vault,
      redirect_base_url = '',
      scopes = ['openid', 'profile', 'email'],
      prompt = '',
      response_type = 'code',
      audience = '',
      claim_mappings = {},
      group_claim = '',
      role_mappings = {},
      use_pkce = true,
      ...extras
    } = typeFields as Record<string, unknown>

    const oidc: OidcFormState = {
      discoveryUrl: String(discovery_url ?? ''),
      clientId: String(client_id ?? ''),
      secretMode: client_secret_vault ? 'vault-existing' : 'value',
      clientSecretInput: '',
      clientSecretExisting: typeof client_secret === 'string' ? client_secret : undefined,
      clientSecretVault: parseVaultSecretRef(client_secret_vault),
      clientSecretNewValue: '',
      redirectBaseUrl: String(redirect_base_url ?? ''),
      scopesText: toListText(scopes),
      prompt: String(prompt ?? ''),
      responseType: String(response_type ?? 'code'),
      audience: String(audience ?? ''),
      groupClaim: String(group_claim ?? ''),
      claimMappingsText: toJsonText(claim_mappings),
      roleMappingsText: toJsonText(role_mappings),
      usePkce: use_pkce !== false,
    }

    return {
      kind: 'oidc',
      base,
      isNew: false,
      extrasJson: JSON.stringify(extras ?? {}, null, 2),
      oidc,
    }
  }

  if (type === 'ldap' || type === 'active_directory') {
    const typedFields = typeFields as Record<string, unknown>
    const {
      server_uri = '',
      bind_dn = '',
      bind_password,
      bind_password_vault,
      user_dn_template = '',
      user_search_base = '',
      user_filter = '',
      start_tls = true,
      attributes = {},
      group_search_base = '',
      group_filter = '',
      group_member_attr = 'memberOf',
      role_mappings = {},
      ...rest
    } = typedFields

    const extras = { ...rest } as Record<string, unknown>
    const defaultDomainValue = type === 'active_directory' ? String(rest.default_domain ?? '') : ''
    if (type === 'active_directory') {
      delete extras.default_domain
    }

    const ldap: LdapFormState = {
      serverUri: String(server_uri ?? ''),
      bindDn: String(bind_dn ?? ''),
      secretMode: bind_password_vault ? 'vault-existing' : 'value',
      bindPasswordInput: '',
      bindPasswordExisting: typeof bind_password === 'string' ? bind_password : undefined,
      bindPasswordVault: parseVaultSecretRef(bind_password_vault),
      bindPasswordNewValue: '',
      userDnTemplate: String(user_dn_template ?? ''),
      userSearchBase: String(user_search_base ?? ''),
      userFilter: String(user_filter ?? ''),
      startTls: start_tls !== false,
      attributesText: toJsonText(attributes),
      groupSearchBase: String(group_search_base ?? ''),
      groupFilter: String(group_filter ?? ''),
      groupMemberAttr: String(group_member_attr ?? 'memberOf'),
      roleMappingsText: toJsonText(role_mappings),
      defaultDomain: type === 'active_directory' ? defaultDomainValue : '',
    }

    return {
      kind: type,
      base,
      isNew: false,
      extrasJson: JSON.stringify(extras ?? {}, null, 2),
      ldap,
    }
  }

  if (type === 'local') {
    const extras = typeFields as Record<string, unknown>
    return {
      kind: 'local',
      base,
      isNew: false,
      extrasJson: JSON.stringify(extras ?? {}, null, 2),
    }
  }

  return {
    kind: 'unknown',
    base,
    isNew: false,
    rawJson: JSON.stringify(config, null, 2),
    type,
  }
}

function createNewFormState(type: ProviderType): ProviderFormState {
  const base: BaseFormState = {
    name: '',
    displayName: '',
    enabled: true,
    defaultRolesText: 'toolkit.user',
  }

  if (type === 'oidc') {
    return {
      kind: 'oidc',
      base,
      isNew: true,
      extrasJson: '{}',
      oidc: {
        discoveryUrl: '',
        clientId: '',
        secretMode: 'vault-new',
        clientSecretInput: '',
        clientSecretExisting: undefined,
        clientSecretVault: defaultVaultSecretFormState(),
        clientSecretNewValue: '',
        redirectBaseUrl: '',
        scopesText: 'openid, profile, email',
        prompt: '',
        responseType: 'code',
        audience: '',
        groupClaim: '',
        claimMappingsText: '',
        roleMappingsText: '',
        usePkce: true,
      },
    }
  }

  if (type === 'ldap' || type === 'active_directory') {
    return {
      kind: type,
      base,
      isNew: true,
      extrasJson: '{}',
      ldap: {
        serverUri: '',
        bindDn: '',
        secretMode: 'vault-new',
        bindPasswordInput: '',
        bindPasswordExisting: undefined,
        bindPasswordVault: defaultVaultSecretFormState(),
        bindPasswordNewValue: '',
        userDnTemplate: '',
        userSearchBase: '',
        userFilter: '',
        startTls: true,
        attributesText: '',
        groupSearchBase: '',
        groupFilter: '',
        groupMemberAttr: 'memberOf',
        roleMappingsText: '',
        defaultDomain: type === 'active_directory' ? '' : undefined,
      },
    }
  }

  if (type === 'local') {
    return {
      kind: 'local',
      base,
      isNew: true,
      extrasJson: '{}',
    }
  }

  return {
    kind: 'unknown',
    base,
    isNew: true,
    rawJson: JSON.stringify(
      {
        name: '',
        type,
        enabled: true,
      },
      null,
      2
    ),
    type,
  }
}

function buildPayload(form: ProviderFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.base.name.trim(),
    type: form.kind === 'unknown' ? form.type : form.kind,
    enabled: form.base.enabled,
  }

  if (!payload.name) {
    throw new Error('Provider name is required.')
  }

  if (form.base.displayName.trim()) {
    payload.display_name = form.base.displayName.trim()
  }
  const defaultRoles = parseList(form.base.defaultRolesText)
  payload.default_roles = defaultRoles

  if (form.kind === 'unknown') {
    const raw = form.rawJson.trim()
    if (!raw) {
      throw new Error('Provide the JSON payload for this provider.')
    }
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error()
      }
      return parsed as Record<string, unknown>
    } catch (err) {
      throw new Error('Invalid JSON payload for provider configuration.')
    }
  }

  const extras = parseOptionalJsonObject(form.extrasJson, 'Advanced JSON overrides')

  if (form.kind === 'oidc') {
    const oidcPayload = buildOidcPayload(form.oidc)
    return {
      ...payload,
      ...oidcPayload,
      ...extras,
    }
  }

  if (form.kind === 'ldap' || form.kind === 'active_directory') {
    const ldapPayload = buildLdapPayload(form.ldap, form.kind === 'active_directory')
    return {
      ...payload,
      ...ldapPayload,
      ...extras,
    }
  }

  if (form.kind === 'local') {
    return {
      ...payload,
      ...extras,
    }
  }

  return payload
}

function buildOidcPayload(state: OidcFormState): Record<string, unknown> {
  if (!state.discoveryUrl.trim()) {
    throw new Error('Discovery URL is required for OIDC providers.')
  }
  if (!state.clientId.trim()) {
    throw new Error('Client ID is required for OIDC providers.')
  }

  const payload: Record<string, unknown> = {
    discovery_url: state.discoveryUrl.trim(),
    client_id: state.clientId.trim(),
    response_type: state.responseType.trim() || 'code',
    use_pkce: state.usePkce,
  }

  if (state.redirectBaseUrl.trim()) {
    payload.redirect_base_url = state.redirectBaseUrl.trim()
  }
  const scopes = parseList(state.scopesText)
  payload.scopes = scopes.length > 0 ? scopes : ['openid', 'profile', 'email']
  if (state.prompt.trim()) {
    payload.prompt = state.prompt.trim()
  }
  if (state.audience.trim()) {
    payload.audience = state.audience.trim()
  }
  if (state.groupClaim.trim()) {
    payload.group_claim = state.groupClaim.trim()
  }
  if (state.claimMappingsText.trim()) {
    payload.claim_mappings = parseJsonObject(state.claimMappingsText, 'Claim mappings must be a valid JSON object.')
  }
  if (state.roleMappingsText.trim()) {
    payload.role_mappings = parseJsonObject(state.roleMappingsText, 'Role mappings must be a valid JSON object.')
  }

  if (state.secretMode === 'vault-existing' || state.secretMode === 'vault-new') {
    payload.client_secret_vault = buildVaultRef(state.clientSecretVault, 'Client secret')
  } else {
    const value = state.clientSecretInput.trim() || state.clientSecretExisting?.trim() || ''
    if (!value) {
      throw new Error('Client secret is required when using plaintext storage.')
    }
    payload.client_secret = value
  }

  return payload
}

function buildLdapPayload(state: LdapFormState, isActiveDirectory: boolean): Record<string, unknown> {
  if (!state.serverUri.trim()) {
    throw new Error('Server URI is required for LDAP providers.')
  }
  const payload: Record<string, unknown> = {
    server_uri: state.serverUri.trim(),
    start_tls: state.startTls,
  }

  if (state.bindDn.trim()) {
    payload.bind_dn = state.bindDn.trim()
  }
  if (state.userDnTemplate.trim()) {
    payload.user_dn_template = state.userDnTemplate.trim()
  }
  if (state.userSearchBase.trim()) {
    payload.user_search_base = state.userSearchBase.trim()
  }
  if (state.userFilter.trim()) {
    payload.user_filter = state.userFilter.trim()
  }
  if (state.groupSearchBase.trim()) {
    payload.group_search_base = state.groupSearchBase.trim()
  }
  if (state.groupFilter.trim()) {
    payload.group_filter = state.groupFilter.trim()
  }
  if (state.groupMemberAttr.trim()) {
    payload.group_member_attr = state.groupMemberAttr.trim()
  }
  if (state.attributesText.trim()) {
    payload.attributes = parseJsonObject(state.attributesText, 'Attribute mappings must be a valid JSON object.')
  }
  if (state.roleMappingsText.trim()) {
    payload.role_mappings = parseJsonObject(state.roleMappingsText, 'Role mappings must be a valid JSON object.')
  }
  if (isActiveDirectory && state.defaultDomain && state.defaultDomain.trim()) {
    payload.default_domain = state.defaultDomain.trim()
  }

  if (state.secretMode === 'vault-existing' || state.secretMode === 'vault-new') {
    payload.bind_password_vault = buildVaultRef(state.bindPasswordVault, 'Bind password')
  } else {
    const value = state.bindPasswordInput.trim() || state.bindPasswordExisting?.trim() || ''
    if (state.bindDn.trim() && !value) {
      throw new Error('Bind password is required when a bind DN is provided (or switch to a Vault reference).')
    }
    if (value) {
      payload.bind_password = value
    }
  }

  return payload
}

function buildVaultRef(state: VaultSecretFormState, label: string): Record<string, unknown> {
  if (!state.path.trim()) {
    throw new Error(`${label}: Vault path is required.`)
  }
  if (!state.key.trim()) {
    throw new Error(`${label}: Vault key is required.`)
  }
  const ref: Record<string, unknown> = {
    path: state.path.trim(),
    key: state.key.trim(),
    engine: state.engine || 'kv-v2',
  }
  if (state.mount.trim()) {
    ref.mount = state.mount.trim()
  }
  if (state.version.trim()) {
    const parsed = Number(state.version)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${label}: Vault version must be a positive number.`)
    }
    ref.version = parsed
  }
  return ref
}

function suggestVaultLocation(name: string, key: string): { path: string; key: string } {
  const trimmed = name.trim().toLowerCase()
  const slug = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'provider'
  return {
    path: `auth/${slug}`,
    key,
  }
}

function sanitizeSlug(name: string): string {
  const trimmed = name.trim().toLowerCase()
  const slug = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'provider'
}

interface PendingVaultWrite {
  ref: VaultSecretFormState
  value: string
  label: string
}

function collectVaultWrites(form: ProviderFormState): PendingVaultWrite[] {
  const writes: PendingVaultWrite[] = []

  if (form.kind === 'oidc' && (form.oidc.secretMode === 'vault-new')) {
    const value = form.oidc.clientSecretNewValue.trim()
    if (!value) {
      throw new Error('Provide a client secret to store in Vault.')
    }
    const refState: VaultSecretFormState = {
      ...form.oidc.clientSecretVault,
    }
    const defaults = suggestVaultLocation(form.base.name, 'client_secret')
    if (!refState.path) {
      refState.path = defaults.path
    }
    if (!refState.key) {
      refState.key = defaults.key
    }
    buildVaultRef(refState, 'Client secret')
    writes.push({
      ref: refState,
      value,
      label: 'OIDC client secret',
    })
  }

  if ((form.kind === 'ldap' || form.kind === 'active_directory') && form.ldap.secretMode === 'vault-new') {
    const value = form.ldap.bindPasswordNewValue.trim()
    if (!value) {
      throw new Error('Provide a bind password to store in Vault.')
    }
    const refState: VaultSecretFormState = {
      ...form.ldap.bindPasswordVault,
    }
    const defaults = suggestVaultLocation(form.base.name, 'bind_password')
    if (!refState.path) {
      refState.path = defaults.path
    }
    if (!refState.key) {
      refState.key = defaults.key
    }
    buildVaultRef(refState, 'Bind password')
    writes.push({
      ref: refState,
      value,
      label: `${form.kind === 'active_directory' ? 'Active Directory' : 'LDAP'} bind password`,
    })
  }

  return writes
}

async function createVaultSecretViaApi(write: PendingVaultWrite): Promise<void> {
  const payload = {
    mount: write.ref.mount || undefined,
    path: write.ref.path,
    key: write.ref.key,
    engine: write.ref.engine,
    value: write.value,
  }
  await apiFetch('/admin/settings/providers/vault-secret', {
    method: 'POST',
    body: payload,
  })
}

function normalizeFormAfterVaultWrites(form: ProviderFormState): ProviderFormState {
  if (form.kind === 'oidc' && form.oidc.secretMode === 'vault-new') {
    return {
      ...form,
      oidc: {
        ...form.oidc,
        secretMode: 'vault-existing',
        clientSecretInput: '',
        clientSecretExisting: undefined,
        clientSecretNewValue: '',
        clientSecretVault: {
          ...form.oidc.clientSecretVault,
          path: form.oidc.clientSecretVault.path || suggestVaultLocation(form.base.name, 'client_secret').path,
          key: form.oidc.clientSecretVault.key || 'client_secret',
        },
      },
    }
  }
  if ((form.kind === 'ldap' || form.kind === 'active_directory') && form.ldap.secretMode === 'vault-new') {
    return {
      ...form,
      ldap: {
        ...form.ldap,
        secretMode: 'vault-existing',
        bindPasswordInput: '',
        bindPasswordExisting: undefined,
        bindPasswordNewValue: '',
        bindPasswordVault: {
          ...form.ldap.bindPasswordVault,
          path: form.ldap.bindPasswordVault.path || suggestVaultLocation(form.base.name, 'bind_password').path,
          key: form.ldap.bindPasswordVault.key || 'bind_password',
        },
      },
    }
  }
  return form
}

function parseList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toListText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'string') {
    return value
  }
  return ''
}

function toJsonText(value: unknown): string {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return ''
  }
}

function parseJsonObject(text: string, errorMessage: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error()
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    throw new Error(errorMessage)
  }
}

function parseOptionalJsonObject(text: string, context: string): Record<string, unknown> {
  if (!text.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error()
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    throw new Error(`${context} must be valid JSON.`)
  }
}
