import React from 'react'
import * as ReactRouterDom from 'react-router-dom'

import { API_BASE_URL, apiFetch } from './api'
import { ToolkitRecord, useToolkits } from './ToolkitContext'
import AdminToolkitsPage from './pages/AdminToolkitsPage'
import DashboardPage from './pages/DashboardPage'
import JobsPage from './pages/JobsPage'
import ToolkitIndexPage from './pages/ToolkitIndexPage'
const { NavLink, Navigate, Route, Routes, useParams } = ReactRouterDom

declare global {
  interface Window {
    __SRE_TOOLKIT_RUNTIME?: {
      react: typeof React
      reactRouterDom: typeof ReactRouterDom
      apiFetch: typeof apiFetch
    }
  }
}

function ensureToolkitRuntime() {
  if (typeof window === 'undefined') {
    return
  }
  const runtime = window.__SRE_TOOLKIT_RUNTIME || {}
  runtime.react = React
  runtime.reactRouterDom = ReactRouterDom
  runtime.apiFetch = apiFetch
  window.__SRE_TOOLKIT_RUNTIME = runtime
}

function ensureToolkitStyles() {
  if (typeof document === 'undefined') {
    return
  }
  if (document.getElementById('sre-toolkit-runtime-styles')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'sre-toolkit-runtime-styles'
  style.textContent = `@keyframes sreToolkitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`
  document.head.append(style)
}

ensureToolkitRuntime()
ensureToolkitStyles()

const modulePromiseCache = new Map<string, Promise<React.ComponentType>>()

function toolkitCacheKey(toolkit: ToolkitRecord) {
  return [
    toolkit.slug,
    toolkit.frontend_entry ?? '',
    toolkit.frontend_source_entry ?? '',
    toolkit.updated_at ?? '',
  ].join('|')
}

function removeStaleToolkitEntries(slug: string, activeKey: string) {
  for (const key of modulePromiseCache.keys()) {
    if (key.startsWith(`${slug}|`) && key !== activeKey) {
      modulePromiseCache.delete(key)
    }
  }
}

async function loadToolkitModule(toolkit: ToolkitRecord): Promise<React.ComponentType> {
  const specifiers: Array<{ kind: 'local' | 'remote'; value: string }> = []

  if (import.meta.env.DEV && toolkit.origin === 'bundled') {
    const sourceEntry = (toolkit.frontend_source_entry || 'frontend/index.tsx').replace(/\\/g, '/').replace(/^\/+/, '')
    specifiers.push({ kind: 'local', value: `../../toolkits/bundled/${toolkit.slug}/${sourceEntry}` })
  }

  const remoteEntry = (toolkit.frontend_entry || 'frontend/dist/index.js').replace(/\\/g, '/').replace(/^\/+/, '')
  let base = API_BASE_URL
  if (!base && typeof window !== 'undefined') {
    base = window.location.origin
  }
  const remoteUrl = new URL(`/toolkit-assets/${toolkit.slug}/${remoteEntry}`, `${base}/`).toString()
  specifiers.push({ kind: 'remote', value: remoteUrl })

  let lastError: unknown
  for (const specifier of specifiers) {
    try {
      const mod = await import(/* @vite-ignore */ specifier.value)
      const candidate = (mod as { default?: React.ComponentType }).default ?? (mod as unknown as React.ComponentType)
      if (candidate) {
        return candidate
      }
    } catch (err) {
      lastError = err
      // eslint-disable-next-line no-console
      console.warn(`Toolkit ${toolkit.slug} import failed for ${specifier.kind} specifier ${specifier.value}`, err)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to load toolkit module for ${toolkit.slug}`)
}

async function resolveToolkitComponent(toolkit: ToolkitRecord): Promise<React.ComponentType> {
  const key = toolkitCacheKey(toolkit)
  removeStaleToolkitEntries(toolkit.slug, key)
  if (!modulePromiseCache.has(key)) {
    modulePromiseCache.set(
      key,
      loadToolkitModule(toolkit).catch((err) => {
        modulePromiseCache.delete(key)
        throw err
      })
    )
  }
  return modulePromiseCache.get(key) as Promise<React.ComponentType>
}

const layoutStyles = {
  app: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    minHeight: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    background: '#f5f7fb',
  } as React.CSSProperties,
  sidebar: {
    background: '#0f172a',
    color: '#e2e8f0',
    padding: '2.3rem 1.75rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.9rem',
  },
  navLink: (active: boolean) => ({
    padding: '0.65rem 1.1rem',
    borderRadius: 10,
    color: active ? '#0f172a' : '#e2e8f0',
    background: active ? '#38bdf8' : 'rgba(148, 163, 184, 0.08)',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
    transition: 'background 0.15s ease',
    fontSize: '0.92rem',
  }),
  navLinkCompact: (active: boolean) => ({
    padding: '0.5rem 0.85rem',
    borderRadius: 8,
    color: active ? '#0f172a' : '#cbd5f5',
    background: active ? '#1fb6ff' : 'rgba(148, 163, 184, 0.12)',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
    transition: 'background 0.15s ease',
    fontSize: '0.85rem',
  }),
  content: {
    padding: '2rem 3rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
  },
}

export default function AppShell() {
  const { toolkits, loading } = useToolkits()
  const enabledToolkits = toolkits
    .filter((toolkit) => toolkit.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={layoutStyles.app}>
      <aside style={layoutStyles.sidebar}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 600 }}>SRE Toolbox</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.9rem' }}>
            Modular operations cockpit
          </p>
        </div>

        <nav style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <p style={navHeadingStyle}>Workspace</p>
            <SidebarLink to="/" label="Dashboard" end />
            <SidebarLink to="/jobs" label="Jobs" />
          </div>

          <div>
            <p style={navHeadingStyle}>Toolkits</p>
            <SidebarLink to="/toolkits" label="All toolkits" />
            <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.35rem', paddingLeft: '0.25rem' }}>
              {enabledToolkits.map((toolkit) => (
                <SidebarLink
                  key={toolkit.slug}
                  to={toolkit.base_path}
                  label={toolkit.name}
                  compact
                />
              ))}
              {enabledToolkits.length === 0 && !loading && (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>No toolkits enabled.</p>
              )}
            </div>
          </div>

          <div>
            <p style={navHeadingStyle}>Administration</p>
            <SidebarLink to="/admin/toolkits" label="Toolkits" />
          </div>
        </nav>

        <div style={{ marginTop: 'auto', fontSize: '0.8rem', opacity: 0.75 }}>
          API base: {API_BASE_URL || 'N/A'}
        </div>
      </aside>

      <div style={layoutStyles.content}>
        <header>
          <h2 style={{ margin: 0 }}>Operations Overview</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>
            Monitor jobs, manage toolkits, and validate automations.
          </p>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/toolkits" element={<ToolkitIndexPage />} />
            <Route path="/toolkits/:slug/*" element={<DynamicToolkitRouter />} />
            <Route path="/admin/toolkits" element={<AdminToolkitsPage />} />
            <Route path="/modules/*" element={<Navigate to="/toolkits" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}


function SidebarLink({
  to,
  label,
  end,
  compact,
}: {
  to: string
  label: string
  end?: boolean
  compact?: boolean
}) {
  const styleFn = compact ? layoutStyles.navLinkCompact : layoutStyles.navLink
  return (
    <NavLink to={to} end={end} style={({ isActive }) => styleFn(isActive)}>
      {label}
    </NavLink>
  )
}


function DynamicToolkitRouter() {
  const { slug = '' } = useParams()
  const { toolkits } = useToolkits()
  const toolkit = toolkits.find((item) => item.slug === slug)

  if (!toolkit) {
    return <Navigate to="/toolkits" replace />
  }

  if (!toolkit.enabled) {
    return <GenericToolkitPlaceholder toolkit={toolkit} message="This toolkit is currently disabled. Enable it from Administration → Toolkits." />
  }

  return <ToolkitRenderer toolkit={toolkit} />
}


function GenericToolkitPlaceholder({ toolkit, message }: { toolkit: ToolkitRecord; message?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}>
      <h3 style={{ marginTop: 0 }}>{toolkit.name}</h3>
      <p style={{ color: '#64748b' }}>{toolkit.description || 'Toolkit metadata registered. Awaiting implementation.'}</p>
      {message ? (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#64748b' }}>{message}</p>
      ) : (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          No frontend experience has been wired for this toolkit yet. Upload its bundle or keep it disabled while you stage upcoming
          functionality.
        </p>
      )}
    </div>
  )
}


function ToolkitRenderer({ toolkit }: { toolkit: ToolkitRecord }) {
  const [Component, setComponent] = React.useState<React.ComponentType | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setComponent(null)
    setError(null)

    resolveToolkitComponent(toolkit)
      .then((resolved) => {
        if (!cancelled) {
          setComponent(() => resolved)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`Failed to load toolkit UI for ${toolkit.slug}`, err)
          setError(err instanceof Error ? err.message : String(err))
        }
      })

    return () => {
      cancelled = true
    }
  }, [toolkit.slug, toolkit.frontend_entry, toolkit.frontend_source_entry, toolkit.updated_at])

  if (error) {
    return <GenericToolkitPlaceholder toolkit={toolkit} message={`Failed to load toolkit UI: ${error}`} />
  }

  if (!Component) {
    return <ToolkitLoadingOverlay name={toolkit.name} />
  }

  return <Component />
}

function ToolkitLoadingOverlay({ name }: { name: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '1.5rem',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        display: 'grid',
        gap: '0.75rem',
        alignItems: 'center',
        justifyItems: 'center',
        minHeight: 160,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#38bdf8',
          animation: 'sreToolkitSpin 0.75s linear infinite',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>Loading toolkit interface…</p>
      </div>
    </div>
  )
}


const navHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.45rem',
  textTransform: 'uppercase',
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  fontWeight: 600,
}
