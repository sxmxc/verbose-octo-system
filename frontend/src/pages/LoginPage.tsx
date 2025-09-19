import React, { FormEvent, useMemo, useState } from 'react'
import { Location, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../AuthContext'
import { MaterialIcon } from '../components/MaterialIcon'

const pageStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '100vh',
  background: 'var(--color-app-bg)',
  color: 'var(--color-text-primary)',
  padding: '2rem',
}

const cardStyle: React.CSSProperties = {
  width: 'min(520px, 100%)',
  background: 'var(--color-surface)',
  borderRadius: 16,
  padding: '2.5rem',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--color-shadow)',
  display: 'grid',
  gap: '1.75rem',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  borderRadius: 8,
  border: '1px solid transparent',
  padding: '0.65rem 1rem',
  cursor: 'pointer',
  fontWeight: 600,
  justifyContent: 'center',
}

export default function LoginPage() {
  const { user, providers, loginWithPassword, beginSso } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: Location } }
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fromLocation = location.state?.from

  const passwordProviders = useMemo(
    () => providers.filter((provider) => ['local', 'ldap', 'active_directory'].includes(provider.type)),
    [providers]
  )
  const ssoProviders = useMemo(
    () => providers.filter((provider) => provider.type === 'oidc'),
    [providers]
  )

  const [formState, setFormState] = useState<Record<string, { username: string; password: string }>>({})

  if (user) {
    return <Navigate to={(fromLocation && fromLocation.pathname) || '/'} replace />
  }

  const handleInputChange = (provider: string, field: 'username' | 'password', value: string) => {
    setFormState((prev) => ({
      ...prev,
      [provider]: {
        username: field === 'username' ? value : prev[provider]?.username || '',
        password: field === 'password' ? value : prev[provider]?.password || '',
      },
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>, provider: string) => {
    event.preventDefault()
    const credentials = formState[provider] || { username: '', password: '' }
    if (!credentials.username || !credentials.password) {
      setError('Username and password are required.')
      return
    }
    setSubmitting(provider)
    setError(null)
    try {
      await loginWithPassword(provider, credentials)
      navigate((fromLocation && fromLocation.pathname) || '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(null)
    }
  }

  const handleBeginSso = async (provider: string) => {
    setError(null)
    setSubmitting(provider)
    try {
      await beginSso(provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <header style={{ display: 'grid', gap: '0.35rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>SRE Toolbox</h1>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Sign in to continue.</p>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 8,
              border: '1px solid var(--color-danger-border)',
              background: 'var(--color-danger-bg, rgba(255, 99, 132, 0.1))',
              color: 'var(--color-danger-text, #b91c1c)',
            }}
          >
            {error}
          </div>
        )}

        {passwordProviders.length > 0 && (
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Username &amp; password</h2>
            {passwordProviders.map((provider) => (
              <form
                key={provider.name}
                onSubmit={(event) => handleSubmit(event, provider.name)}
                style={{ display: 'grid', gap: '0.75rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MaterialIcon name="person" />
                  <strong>{provider.display_name}</strong>
                </div>
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
                  Username
                  <input
                    type="text"
                    name={`${provider.name}-username`}
                    autoComplete="username"
                    value={formState[provider.name]?.username || ''}
                    onChange={(event) => handleInputChange(provider.name, 'username', event.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
                  Password
                  <input
                    type="password"
                    name={`${provider.name}-password`}
                    autoComplete="current-password"
                    value={formState[provider.name]?.password || ''}
                    onChange={(event) => handleInputChange(provider.name, 'password', event.target.value)}
                    style={inputStyle}
                  />
                </label>
                <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    background: 'var(--color-sidebar-button-bg)',
                    color: 'var(--color-sidebar-button-text)',
                    borderColor: 'var(--color-border)',
                  }}
                  disabled={submitting === provider.name}
                >
                  {submitting === provider.name ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ))}
          </section>
        )}

        {ssoProviders.length > 0 && (
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Single sign-on</h2>
            {ssoProviders.map((provider) => (
              <button
                key={provider.name}
                type="button"
                onClick={() => handleBeginSso(provider.name)}
                style={{
                  ...buttonStyle,
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface-alt, rgba(0,0,0,0.05))',
                }}
                disabled={submitting === provider.name}
              >
                <MaterialIcon name="login" />
                {submitting === provider.name ? 'Opening…' : `Continue with ${provider.display_name}`}
              </button>
            ))}
          </section>
        )}

        {providers.length === 0 && (
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            No authentication providers are configured. Contact your system administrator.
          </p>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  padding: '0.55rem 0.75rem',
  fontSize: '0.95rem',
  background: 'var(--color-surface-alt, #fff)',
  color: 'var(--color-text-primary)',
}
