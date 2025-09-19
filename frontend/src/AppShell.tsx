import React from 'react'
import * as ReactRouterDom from 'react-router-dom'

import { API_BASE_URL, apiFetch } from './api'
import { MaterialIcon } from './components/MaterialIcon'
import { useTheme } from './ThemeContext'
import { ToolkitRecord, useToolkits } from './ToolkitContext'
import toolkitPrimitivesStyles from './toolkitPrimitives.css?inline'
import AdminToolkitsPage from './pages/AdminToolkitsPage'
import DashboardPage from './pages/DashboardPage'
import DocumentationPage from './pages/DocumentationPage'
import JobsPage from './pages/JobsPage'
import ToolkitIndexPage from './pages/ToolkitIndexPage'
const { NavLink, Navigate, Route, Routes, useParams } = ReactRouterDom

type ToolkitRuntime = {
  react: typeof React
  reactRouterDom: typeof ReactRouterDom
  apiFetch: typeof apiFetch
}

declare global {
  interface Window {
    __SRE_TOOLKIT_RUNTIME?: Partial<ToolkitRuntime>
  }
}

function ensureToolkitRuntime() {
  if (typeof window === 'undefined') {
    return
  }
  const runtime: Partial<ToolkitRuntime> = window.__SRE_TOOLKIT_RUNTIME ?? {}
  runtime.react = React
  runtime.reactRouterDom = ReactRouterDom
  runtime.apiFetch = apiFetch
  window.__SRE_TOOLKIT_RUNTIME = runtime as ToolkitRuntime
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
  style.textContent = [
    '@keyframes sreToolkitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
    toolkitPrimitivesStyles,
  ]
    .filter(Boolean)
    .join('\n')
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
    background: 'var(--color-app-bg)',
    color: 'var(--color-text-primary)',
  } as React.CSSProperties,
  sidebar: {
    background: 'var(--color-sidebar-bg)',
    color: 'var(--color-sidebar-text)',
    padding: '1rem 1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
    height: '98vh',
    boxSizing: 'border-box' as const,
    position: 'sticky' as const,
    top: '8px',
    overflowY: 'auto' as const,
  },
  navLinkVariants: {
    standard: (active: boolean) => ({
      padding: '0.5rem 0.85rem',
      borderRadius: 8,
      color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-sidebar-item-text)',
      background: active ? 'var(--color-sidebar-item-active-bg)' : 'var(--color-sidebar-item-bg)',
      fontWeight: active ? 600 : 500,
      textDecoration: 'none',
      transition: 'background 0.15s ease',
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }),
    prominent: (active: boolean) => ({
      padding: '0.58rem 0.95rem',
      borderRadius: 9,
      color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-sidebar-text)',
      background: active ? 'var(--color-sidebar-button-active-bg)' : 'var(--color-sidebar-item-bg)',
      fontWeight: active ? 600 : 550,
      textDecoration: 'none',
      transition: 'background 0.15s ease',
      fontSize: '0.9rem',
      boxShadow: active ? '0 0 0 1px var(--color-outline)' : 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '0.55rem',
    }),
    button: (active: boolean) => ({
      padding: '0.65rem 1rem',
      borderRadius: 999,
      color: active ? 'var(--color-sidebar-button-active-text)' : 'var(--color-sidebar-button-text)',
      background: active ? 'var(--color-sidebar-button-active-bg)' : 'var(--color-sidebar-button-bg)',
      fontWeight: 600,
      textDecoration: 'none',
      transition: 'background 0.15s ease, transform 0.15s ease',
      fontSize: '0.85rem',
      textAlign: 'center' as const,
      boxShadow: active ? '0 10px 25px -12px var(--color-outline)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.45rem',
    }),
  } as Record<'standard' | 'prominent' | 'button', (active: boolean) => React.CSSProperties>,
  content: {
    padding: '2rem 3rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
    color: 'var(--color-text-primary)',
  },
}

const themeToggleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  border: '1px solid transparent',
  background: 'var(--color-sidebar-button-bg)',
  color: 'var(--color-sidebar-button-text)',
  padding: '0.55rem 0.9rem',
  cursor: 'pointer',
  transition: 'background 0.15s ease, transform 0.15s ease',
}

export default function AppShell() {
  const { toolkits, loading } = useToolkits()
  const { toggleTheme, isDark } = useTheme()
  const enabledToolkits = toolkits
    .filter((toolkit) => toolkit.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div style={layoutStyles.app}>
      <aside style={layoutStyles.sidebar}>
          <div style={sidebarMainArea}>
            <div>
              <h1 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 600 }}>SRE Toolbox</h1>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.9rem', color: 'var(--color-sidebar-muted)' }}>
                Modular operations cockpit
              </p>
            </div>

          <nav style={{ display: 'grid', gap: '1.2rem', flex: 1 }}>
            <div style={{ display: 'inline-flex', gap: '.25rem', flexDirection: 'column' }}>
              <p style={navHeadingStyle}>Workspace</p>
              <SidebarLink to="/" label="Dashboard" icon="space_dashboard" end />
              <SidebarLink to="/jobs" label="Jobs" icon="work_history" />
            </div>

            <div>
              <p style={navHeadingStyle}>Toolkits</p>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {toolkits.length > 0 && (
                  <SidebarLink to="/toolkits" label="All toolkits" icon="apps" variant="prominent" />
                )}
              </div>
              <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.35rem', paddingLeft: '0.35rem' }}>
                {enabledToolkits.map((toolkit) => (
                  <SidebarLink
                    key={toolkit.slug}
                    to={toolkit.base_path}
                    label={toolkit.name}
                    icon="extension"
                  />
                ))}
                {enabledToolkits.length === 0 && !loading && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>No toolkits enabled.</p>
                )}
              </div>
            </div>

            <div>
              <p style={navHeadingStyle}>Administration</p>
              <SidebarLink to="/admin/toolkits" label="Toolkits" icon="tune" />
            </div>
          </nav>
          </div>

          <div style={sidebarFooterArea}>
            <button
              type="button"
              onClick={toggleTheme}
              style={themeToggleStyle}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              value={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} style={{ color: 'inherit', fontSize: '1.6rem' }} />
            </button>
            <SidebarLink to="/documentation" label="Documentation" icon="menu_book" variant="button" />
            <div style={{ fontSize: '0.8rem', opacity: 0.75, color: 'var(--color-sidebar-muted)' }}>
              API base: {API_BASE_URL || 'N/A'}
            </div>
          </div>
      </aside>

      <div style={layoutStyles.content}>
        <header>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Operations Overview</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>
            Monitor jobs, manage toolkits, and validate automations.
          </p>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/documentation/*" element={<DocumentationPage />} />
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
  icon,
  end,
  variant = 'standard',
}: {
  to: string
  label: string
  icon?: string
  end?: boolean
  variant?: 'standard' | 'prominent' | 'button'
}) {
  const styleFn = layoutStyles.navLinkVariants[variant]
  return (
    <NavLink to={to} end={end} style={({ isActive }) => styleFn(isActive)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
        {icon && <MaterialIcon name={icon} style={{ color: 'inherit' }} />}
        <span>{label}</span>
      </span>
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
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 12,
        padding: '1.5rem',
        boxShadow: 'var(--color-shadow)',
        border: '1px solid var(--color-border)',
      }}
    >
      <h3 style={{ marginTop: 0 }}>{toolkit.name}</h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>{toolkit.description || 'Toolkit metadata registered. Awaiting implementation.'}</p>
      {message ? (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{message}</p>
      ) : (
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
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
        background: 'var(--color-surface)',
        borderRadius: 12,
        padding: '1.5rem',
        boxShadow: 'var(--color-shadow)',
        border: '1px solid var(--color-border)',
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
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          animation: 'sreToolkitSpin 0.75s linear infinite',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading toolkit interface…</p>
      </div>
    </div>
  )
}


const navHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.45rem',
  textTransform: 'uppercase',
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  color: 'var(--color-sidebar-muted)',
  fontWeight: 600,
}

const sidebarMainArea: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '1.2rem',
  //flex: 1,
}

const sidebarFooterArea: React.CSSProperties = {
  display: 'grid',
  gap: '0.6rem',
  marginTop: 'auto',
  paddingTop: '0.5rem',
}
