import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { apiFetch } from '../api'
import { useAuth } from '../AuthContext'
import { MaterialIcon } from '../components/MaterialIcon'

interface ManagedUser {
  id: string
  username: string
  email: string | null
  display_name: string | null
  roles: string[]
  is_superuser: boolean
  is_active: boolean
}

const ROLE_DEFINITIONS: Array<{ value: string; label: string; description: string }> = [
  {
    value: 'toolkit.user',
    label: 'Toolkit User',
    description: 'Access installed toolkits and run jobs.',
  },
  {
    value: 'toolkit.curator',
    label: 'Toolkit Curator',
    description: 'Enable or disable toolkits and manage operations content.',
  },
  {
    value: 'system.admin',
    label: 'System Administrator',
    description: 'Full control, including security settings and provider configuration.',
  },
]

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  padding: '2rem',
  boxShadow: 'var(--color-shadow)',
  display: 'grid',
  gap: '1.5rem',
}

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  padding: '0.5rem 0.7rem',
  background: 'var(--color-surface-alt, #fff)',
  color: 'var(--color-text-primary)',
  width: '100%',
}

function emptyCreateForm() {
  return {
    username: '',
    password: '',
    email: '',
    displayName: '',
    roles: ['toolkit.user'],
    isSuperuser: false,
  }
}

export default function AdminUsersPage() {
  const { user: currentUser, providers } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createForm, setCreateForm] = useState(() => emptyCreateForm())
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    displayName: '',
    roles: [] as string[],
    isSuperuser: false,
    isActive: true,
  })
  const [importProvider, setImportProvider] = useState('')
  const [importPayload, setImportPayload] = useState('')
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<ManagedUser[]>('/admin/users')
      setUsers(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const roleOptions = useMemo(() => {
    if (currentUser?.is_superuser) {
      return ROLE_DEFINITIONS
    }
    return ROLE_DEFINITIONS.filter((role) => role.value !== 'system.admin')
  }, [currentUser])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createForm.username || !createForm.password) {
      setError('Username and password are required to create a user.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        username: createForm.username.trim(),
        password: createForm.password,
        email: createForm.email || null,
        display_name: createForm.displayName || null,
        roles: createForm.roles,
        is_superuser: currentUser?.is_superuser ? createForm.isSuperuser : false,
      }
      const response = await apiFetch<ManagedUser>('/admin/users', {
        method: 'POST',
        body: payload,
      })
      setUsers((prev) => [...prev, response])
      setCreateForm(emptyCreateForm())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const beginEdit = (record: ManagedUser) => {
    setEditingUserId(record.id)
    setEditForm({
      email: record.email || '',
      displayName: record.display_name || '',
      roles: record.roles.slice(),
      isSuperuser: record.is_superuser,
      isActive: record.is_active,
    })
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>, record: ManagedUser) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload = {
        email: editForm.email || null,
        display_name: editForm.displayName || null,
        roles: editForm.roles,
        is_superuser: currentUser?.is_superuser ? editForm.isSuperuser : record.is_superuser,
        is_active: editForm.isActive,
      }
      const response = await apiFetch<ManagedUser>(`/admin/users/${record.id}`, {
        method: 'PATCH',
        body: payload,
      })
      setUsers((prev) => prev.map((item) => (item.id === record.id ? response : item)))
      setEditingUserId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (record: ManagedUser) => {
    if (!window.confirm(`Delete user ${record.username}? This cannot be undone.`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/admin/users/${record.id}`, { method: 'DELETE', skipJson: true })
      setUsers((prev) => prev.filter((item) => item.id !== record.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const identityProviders = useMemo(
    () => providers.filter((provider) => provider.type !== 'local'),
    [providers]
  )

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!importProvider) {
      setImportMessage('Select the authentication provider to import users for.')
      return
    }
    if (!importPayload.trim()) {
      setImportMessage('Paste user entries in JSON format to import.')
      return
    }
    try {
      const parsed = JSON.parse(importPayload)
      if (!Array.isArray(parsed)) {
        setImportMessage('Import payload must be a JSON array of entries.')
        return
      }
      const response = await apiFetch<ManagedUser[]>(`/admin/users/import`, {
        method: 'POST',
        body: {
          provider: importProvider,
          entries: parsed,
        },
      })
      const map = new Map(users.map((user) => [user.id, user]))
      response.forEach((user) => {
        map.set(user.id, user)
      })
      setUsers(Array.from(map.values()))
      setImportMessage(`Imported ${response.length} user(s) successfully.`)
      setImportPayload('')
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={cardStyle}>
      <header>
        <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MaterialIcon name="group" />
          User management
        </h2>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)' }}>
          Invite teammates, manage roles, and control their access to the toolbox.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--color-danger-border)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: 'var(--color-danger-text, #b91c1c)',
            background: 'var(--color-danger-bg, rgba(248, 113, 113, 0.12))',
          }}
        >
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Existing users</h3>
          <button
            type="button"
            onClick={loadUsers}
            style={{ ...buttonStyle, padding: '0.45rem 0.75rem' }}
            disabled={loading || busy}
          >
            <MaterialIcon name="refresh" /> Refresh
          </button>
        </header>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Loading users…</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No users found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {users.map((record) => (
              <div
                key={record.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '1rem 1.2rem',
                  background: 'var(--color-surface-alt, rgba(0, 0, 0, 0.02))',
                  display: 'grid',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{record.username}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      {record.display_name || '—'} · {record.email || 'no email'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => beginEdit(record)}
                      style={{ ...buttonStyle, padding: '0.3rem 0.65rem', borderColor: 'var(--color-border)' }}
                      disabled={busy && editingUserId !== record.id}
                    >
                      Edit
                    </button>
                    {record.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(record)}
                        style={{
                          ...buttonStyle,
                          padding: '0.3rem 0.65rem',
                          background: 'var(--color-danger-bg, rgba(248, 113, 113, 0.12))',
                          color: 'var(--color-danger-text, #b91c1c)',
                          borderColor: 'var(--color-danger-border, #f87171)',
                        }}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Roles: {record.roles.length ? record.roles.join(', ') : 'none'} · Status:{' '}
                  {record.is_active ? 'Active' : 'Disabled'}
                </div>

                {editingUserId === record.id && (
                  <form
                    onSubmit={(event) => handleUpdate(event, record)}
                    style={{ display: 'grid', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}
                  >
                    <div style={twoColumnRowStyle}>
                      <label style={labelStyle}>
                        Display name
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Email
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <fieldset style={fieldsetStyle}>
                      <legend style={legendStyle}>Roles</legend>
                      <div style={{ display: 'grid', gap: '0.45rem' }}>
                        {roleOptions.map((role) => (
                          <label key={role.value} style={checkboxCardStyle}>
                            <input
                              type="checkbox"
                              checked={editForm.roles.includes(role.value)}
                              onChange={(event) => {
                                const checked = event.target.checked
                                setEditForm((prev) => ({
                                  ...prev,
                                  roles: checked
                                    ? Array.from(new Set([...prev.roles, role.value]))
                                    : prev.roles.filter((value) => value !== role.value),
                                }))
                              }}
                              disabled={!currentUser?.is_superuser && role.value === 'system.admin'}
                              style={checkboxInputStyle}
                            />
                            <span style={checkboxLabelTextStyle}>
                              <strong>{role.label}</strong>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{role.description}</div>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div style={inlineSwitchRowStyle}>
                      <label style={inlineSwitchLabelStyle}>
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                        />
                        Active account
                      </label>
                      {currentUser?.is_superuser && (
                        <label style={inlineSwitchLabelStyle}>
                          <input
                            type="checkbox"
                            checked={editForm.isSuperuser}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, isSuperuser: event.target.checked }))}
                          />
                          Superuser
                        </label>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="submit"
                        style={{ ...buttonStyle, borderColor: 'var(--color-border)' }}
                        disabled={busy}
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingUserId(null)}
                        style={{
                          ...buttonStyle,
                          background: 'transparent',
                          borderColor: 'transparent',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Invite new user</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={twoColumnRowStyle}>
            <label style={labelStyle}>
              Username
              <input
                type="text"
                value={createForm.username}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              Password
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                style={inputStyle}
                required
              />
            </label>
          </div>
          <div style={twoColumnRowStyle}>
            <label style={labelStyle}>
              Display name
              <input
                type="text"
                value={createForm.displayName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Email
              <input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Roles</legend>
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {roleOptions.map((role) => (
                <label key={role.value} style={checkboxCardStyle}>
                  <input
                    type="checkbox"
                    checked={createForm.roles.includes(role.value)}
                    onChange={(event) => {
                      const checked = event.target.checked
                      setCreateForm((prev) => ({
                        ...prev,
                        roles: checked
                          ? Array.from(new Set([...prev.roles, role.value]))
                          : prev.roles.filter((value) => value !== role.value),
                      }))
                    }}
                    disabled={!currentUser?.is_superuser && role.value === 'system.admin'}
                    style={checkboxInputStyle}
                  />
                  <span style={checkboxLabelTextStyle}>
                    <strong>{role.label}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{role.description}</div>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {currentUser?.is_superuser && (
            <label style={inlineSwitchLabelStyle}>
              <input
                type="checkbox"
                checked={createForm.isSuperuser}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, isSuperuser: event.target.checked }))}
              />
              Grant superuser access
            </label>
          )}
          <button
            type="submit"
            style={{ ...buttonStyle, borderColor: 'var(--color-border)' }}
            disabled={busy}
          >
            Create user
          </button>
        </form>
      </section>

      {identityProviders.length > 0 && (
        <section style={{ display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Import users from provider</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Paste user entries as JSON objects with fields <code>external_id</code>, <code>username</code>, <code>email</code>, <code>display_name</code>,
            and optional <code>roles</code>.
          </p>
          <form onSubmit={handleImport} style={{ display: 'grid', gap: '0.75rem' }}>
            <label style={labelStyle}>
              Provider
              <select
                value={importProvider}
                onChange={(event) => setImportProvider(event.target.value)}
                style={{ ...inputStyle, padding: '0.55rem 0.7rem' }}
              >
                <option value="">Select provider…</option>
                {identityProviders.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              JSON entries
              <textarea
                value={importPayload}
                onChange={(event) => setImportPayload(event.target.value)}
                rows={6}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)' }}
              />
            </label>
            <button type="submit" style={{ ...buttonStyle, borderColor: 'var(--color-border)' }} disabled={busy}>
              Import users
            </button>
            {importMessage && <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{importMessage}</p>}
          </form>
        </section>
      )}
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  borderRadius: 8,
  border: '1px solid transparent',
  padding: '0.55rem 0.9rem',
  background: 'var(--color-sidebar-button-bg)',
  color: 'var(--color-sidebar-button-text)',
  cursor: 'pointer',
  fontWeight: 600,
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.9rem',
}

const fieldsetStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  padding: '0.75rem 1rem',
  display: 'grid',
  gap: '0.5rem',
}

const legendStyle: React.CSSProperties = {
  padding: '0 0.4rem',
  fontSize: '0.85rem',
  fontWeight: 600,
}

const twoColumnRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  alignItems: 'end',
}

const checkboxCardStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.6rem',
  alignItems: 'flex-start',
  padding: '0.55rem 0.7rem',
  borderRadius: 10,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt, rgba(255, 255, 255, 0.05))',
  cursor: 'pointer',
}

const checkboxLabelTextStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
}

const checkboxInputStyle: React.CSSProperties = {
  marginTop: '0.25rem',
}

const inlineSwitchRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'center',
}

const inlineSwitchLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.88rem',
}
