import React from 'react'
import * as ReactRouterDom from 'react-router-dom'

import { apiFetch } from './api'
import { API_BASE_URL } from './config'
import { MaterialIcon } from './components/MaterialIcon'
import { useTheme } from './ThemeContext'
import { ToolkitRecord, useToolkits } from './ToolkitContext'
import toolkitPrimitivesStyles from './toolkitPrimitives.css?inline'
import { useAuth } from './AuthContext'
import './AppShell.css'
import AdminToolkitsPage from './pages/AdminToolkitsPage'
import AdminToolkitsCatalogPage from './pages/admin/toolkits/AdminToolkitsCatalogPage'
import AdminToolkitsOverviewPage from './pages/admin/toolkits/AdminToolkitsOverviewPage'
import AdminToolkitsUploadPage from './pages/admin/toolkits/AdminToolkitsUploadPage'
import AdminToolboxSettingsPage from './pages/admin/toolbox/AdminToolboxSettingsPage'
import AdminToolboxCatalogPage from './pages/admin/toolbox/AdminToolboxCatalogPage'
import AdminToolboxAuthPage from './pages/admin/toolbox/AdminToolboxAuthPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSecurityPage from './pages/AdminSecurityPage'
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

export default function AppShell() {
  const { toolkits, loading } = useToolkits()
  const { toggleTheme, isDark } = useTheme()
  const { user, logout, hasRole } = useAuth()
  const enabledToolkits = toolkits
    .filter((toolkit) => toolkit.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))
  const canAdminToolkits = hasRole('toolkit.curator')
  const canManageUsers = hasRole('toolkit.curator')
  const canManageAuth = user?.is_superuser ?? false
  const canViewSecurity = hasRole('system.admin')

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__branding">
          <div className="app-shell__badge">SRE</div>
          <div className="app-shell__branding-text">
            <h1>SRE Toolbox</h1>
            <p>Modular operations cockpit</p>
          </div>
        </div>

        <nav className="app-shell__nav" aria-label="Toolbox navigation">
          <SidebarSection title="Workspace" icon="dashboard" description="Monitor and oversee workloads">
            <SidebarLink to="/" label="Dashboard" icon="space_dashboard" end />
            <SidebarLink to="/jobs" label="Jobs" icon="work_history" />
          </SidebarSection>

          <SidebarSection title="Toolkits" icon="apps" description="Installed modules and experiences">
            {toolkits.length > 0 && <SidebarLink to="/toolkits" label="All toolkits" icon="grid_view" variant="prominent" />}
            <div className="app-shell__toolkit-list">
              {enabledToolkits.map((toolkit) => (
                <SidebarLink key={toolkit.slug} to={toolkit.base_path} label={toolkit.name} icon="extension" />
              ))}
              {enabledToolkits.length === 0 && !loading && <p className="app-shell__empty-state">No toolkits enabled.</p>}
            </div>
          </SidebarSection>

          {(canAdminToolkits || canManageUsers || canManageAuth || canViewSecurity) && (
            <SidebarSection
              title="Administration"
              icon="admin_panel_settings"
              description="Configuration and access controls"
            >
              {canAdminToolkits && <SidebarLink to="/admin/toolkits" label="Toolkits" icon="tune" />}
              {canManageAuth && <SidebarLink to="/admin/settings/toolbox" label="Toolbox settings" icon="settings" />}
              {canManageUsers && <SidebarLink to="/admin/users" label="Users" icon="group" />}
              {canViewSecurity && <SidebarLink to="/admin/security/audit" label="Security" icon="shield_lock" />}
            </SidebarSection>
          )}
        </nav>

        <div className="app-shell__footer">
          {user && <SidebarUserCard user={user} onLogout={logout} />}
          <div className="app-shell__footer-controls">
            <button
              type="button"
              onClick={toggleTheme}
              className="app-shell__theme-toggle"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              value={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} style={{ color: 'inherit', fontSize: '1.35rem' }} />
              <span>{isDark ? 'Dark' : 'Light'} mode</span>
            </button>
            <SidebarLink to="/documentation" label="Documentation" icon="menu_book" variant="button" />
          </div>
          <div className="app-shell__api-meta">API base: {API_BASE_URL || 'N/A'}</div>
        </div>
      </aside>

      <div className="app-shell__content">
        <header>
          <h2>Operations Overview</h2>
          <p>Monitor jobs, manage toolkits, and validate automations.</p>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/documentation/*" element={<DocumentationPage />} />
            <Route path="/toolkits" element={<ToolkitIndexPage />} />
            <Route path="/toolkits/:slug/*" element={<DynamicToolkitRouter />} />
            <Route
              path="/admin/toolkits/*"
              element={
                <RequireRole role="toolkit.curator">
                  <AdminToolkitsPage />
                </RequireRole>
              }
            >
              <Route index element={<AdminToolkitsOverviewPage />} />
              <Route path="community" element={<AdminToolkitsCatalogPage />} />
              <Route path="upload" element={<AdminToolkitsUploadPage />} />
            </Route>
            <Route
              path="/admin/users"
              element={
                <RequireRole role="toolkit.curator">
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings/toolbox/*"
              element={
                <RequireSuperuser>
                  <AdminToolboxSettingsPage />
                </RequireSuperuser>
              }
            >
              <Route index element={<AdminToolboxCatalogPage />} />
              <Route path="auth" element={<AdminToolboxAuthPage />} />
            </Route>
            <Route path="/admin/settings/auth" element={<Navigate to="/admin/settings/toolbox/auth" replace />} />
            <Route
              path="/admin/security/audit"
              element={
                <RequireRole role="system.admin">
                  <AdminSecurityPage />
                </RequireRole>
              }
            />
            <Route path="/modules/*" element={<Navigate to="/toolkits" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}


function RequireRole({ role, children }: { role: string; children: React.ReactElement }) {
  const { hasRole, user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!hasRole(role)) {
    return <Navigate to="/" replace />
  }
  return children
}


function RequireSuperuser({ children }: { children: React.ReactElement }) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!user.is_superuser) {
    return <Navigate to="/" replace />
  }
  return children
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
  const baseClass = `app-shell__nav-link app-shell__nav-link--${variant}`
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [baseClass, isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
    >
      <span className="app-shell__nav-link-content">
        {icon && <MaterialIcon name={icon} style={{ color: 'inherit' }} />}
        <span>{label}</span>
      </span>
    </NavLink>
  )
}

type AuthenticatedUser = NonNullable<ReturnType<typeof useAuth>['user']>

function SidebarUserCard({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => void | Promise<void> }) {
  const displayName = user.display_name?.trim() || user.username
  const detail = user.email || user.username
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="app-shell__user-card">
      <div className="app-shell__user-initials" aria-hidden>{initial}</div>
      <div className="app-shell__user-details">
        <span className="app-shell__user-name">{displayName}</span>
        <span className="app-shell__user-detail">{detail}</span>
      </div>
      <button
        type="button"
        onClick={() => onLogout()}
        className="app-shell__icon-button"
        aria-label="Sign out"
      >
        <MaterialIcon name="logout" style={{ fontSize: '1.1rem' }} />
      </button>
    </div>
  )
}

function SidebarSection({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="app-shell__section">
      <header className="app-shell__section-header">
        <span>
          {icon && <MaterialIcon name={icon} style={{ color: 'var(--color-sidebar-muted)' }} />}
          <span>{title}</span>
        </span>
        {description && <p className="app-shell__section-description">{description}</p>}
      </header>
      <div className="app-shell__section-body">{children}</div>
    </section>
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
    <div className="app-shell__placeholder">
      <h3 style={{ marginTop: 0 }}>{toolkit.name}</h3>
      <p>{toolkit.description || 'Toolkit metadata registered. Awaiting implementation.'}</p>
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
