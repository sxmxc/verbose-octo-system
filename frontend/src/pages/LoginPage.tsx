import React, { FormEvent, useMemo, useState } from 'react'
import { Location, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../AuthContext'
import { MaterialIcon } from '../components/MaterialIcon'

const layoutStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 'clamp(2rem, 6vw, 5rem)',
  background: 'radial-gradient(140% 140% at 15% 20%, rgba(59, 130, 246, 0.14), transparent 65%), var(--color-app-bg)',
  color: 'var(--color-text-primary)',
}

const loginCardStyle: React.CSSProperties = {
  width: 'min(520px, 92vw)',
  background: 'var(--color-surface)',
  borderRadius: 24,
  padding: '2.75rem clamp(2rem, 4vw, 3.25rem)',
  border: '1px solid color-mix(in srgb, var(--color-border) 65%, transparent)',
  boxShadow: '0 22px 60px rgba(15, 23, 42, 0.22)',
  display: 'grid',
  gap: '1.75rem',
  alignContent: 'start',
  position: 'relative',
  overflow: 'hidden',
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.55rem',
  borderRadius: 999,
  border: '1px solid transparent',
  padding: '0.7rem 1.15rem',
  cursor: 'pointer',
  fontWeight: 600,
  justifyContent: 'center',
  transition: 'transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease',
}

const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  padding: '0.7rem 0.85rem',
  fontSize: '1rem',
  background: 'var(--color-surface-alt, #fff)',
  color: 'var(--color-text-primary)',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
}

const supportTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.5,
}

export default function LoginPage() {
  const { user, providers, loading, loginWithPassword, beginSso } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: Location } }
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fromLocation = location.state?.from

  const passwordProviders = useMemo(
    () => providers.filter((provider) => ['local', 'ldap', 'active_directory'].includes(provider.type)),
    [providers]
  )
  const ssoProviders = useMemo(() => providers.filter((provider) => provider.type === 'oidc'), [providers])
  
  const [formState, setFormState] = useState<Record<string, { username: string; password: string }>>({})

  if (user) {
    return <Navigate to={(fromLocation && fromLocation.pathname) || '/'} replace />
  }

  const isBusy = loading || submitting !== null

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
    <div style={layoutStyle}>
      <section style={loginCardStyle}>
        <header style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.12), rgba(45, 212, 191, 0.18))',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MaterialIcon name="shield" style={{ color: 'var(--color-link)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Welcome back</h2>
              <p style={supportTextStyle}>Authenticate with your organisation’s preferred method.</p>
            </div>
          </div>
        </header>

        {isBusy && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backdropFilter: 'blur(4px)',
              background: 'rgba(15, 23, 42, 0.06)',
              borderRadius: 'inherit',
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              zIndex: 2,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            {submitting ? 'Connecting…' : 'Loading authentication options…'}
          </div>
        )}

        {providers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '-0.5rem' }}>
            {providers.map((provider) => (
              <span
                key={provider.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 999,
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                <MaterialIcon name={provider.type === 'oidc' ? 'hub' : provider.type === 'local' ? 'badge' : 'vpn_key'} style={{ fontSize: '1rem' }} />
                {provider.display_name}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 12,
              border: '1px solid rgba(248, 113, 113, 0.4)',
              background: 'rgba(248, 113, 113, 0.12)',
              color: 'var(--color-danger-text, #b91c1c)',
            }}
          >
            {error}
          </div>
        )}

        {passwordProviders.length > 0 && (
          <section style={{ display: 'grid', gap: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <MaterialIcon name="badge" style={{ color: 'var(--color-link)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Username &amp; password</h3>
            </div>
            {passwordProviders.map((provider) => (
              <form
                key={provider.name}
                onSubmit={(event) => handleSubmit(event, provider.name)}
                style={{ display: 'grid', gap: '0.9rem', position: 'relative' }}
              >
                <fieldset
                  style={{
                    border: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)',
                    borderRadius: 18,
                    padding: '1rem',
                    margin: 0,
                    display: 'grid',
                    gap: '0.9rem',
                  }}
                >
                  <legend
                    style={{
                      padding: '0 0.6rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                    }}
                  >
                    {provider.display_name}
                  </legend>
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
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0.35))',
                      color: 'var(--color-text-primary)',
                      borderColor: 'transparent',
                    }}
                    disabled={submitting === provider.name}
                  >
                    {submitting === provider.name ? 'Signing in…' : 'Sign in'}
                  </button>
                </fieldset>
              </form>
            ))}
          </section>
        )}

        {ssoProviders.length > 0 && (
          <section style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <MaterialIcon name="hub" style={{ color: 'var(--color-link)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Single sign-on</h3>
            </div>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {ssoProviders.map((provider) => (
                <button
                  key={provider.name}
                  type="button"
                  onClick={() => handleBeginSso(provider.name)}
                  style={{
                    ...buttonStyle,
                    justifyContent: 'space-between',
                    border: '1px solid color-mix(in srgb, var(--color-border) 70%, transparent)',
                    background: 'linear-gradient(120deg, rgba(15, 118, 110, 0.12), rgba(15, 118, 110, 0.04))',
                  }}
                  disabled={submitting === provider.name}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <MaterialIcon name="login" />
                    <span>{provider.display_name}</span>
                  </span>
                  <MaterialIcon name="arrow_outward" />
                </button>
              ))}
            </div>
          </section>
        )}

        {providers.length === 0 && !loading && (
          <p style={supportTextStyle}>
            No authentication providers are currently configured. Contact your operations team to provision one through the admin console.
          </p>
        )}

        <footer style={{ display: 'grid', gap: '0.35rem' }}>
          <p style={supportTextStyle}>
            Having trouble? Reach the on-call SRE via <a href="mailto:oncall@example.com">oncall@example.com</a>.
          </p>
          <p style={{ ...supportTextStyle, fontSize: '0.8rem' }}>
            By continuing you agree to the acceptable use policy and acknowledge monitoring for operational quality.
          </p>
        </footer>
      </section>
    </div>
  )
}
