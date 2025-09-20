import React from 'react'
import * as ReactRouterDom from 'react-router-dom'

import { apiFetch } from './api'
import { API_BASE_URL } from './config'
import { MaterialIcon } from './components/MaterialIcon'
import { useTheme } from './ThemeContext'
import { ToolkitRecord, useToolkits } from './ToolkitContext'
import toolkitPrimitivesStyles from './toolkitPrimitives.css?inline'
import { useAuth } from './AuthContext'
import AdminToolkitsPage from './pages/AdminToolkitsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSecurityPage from './pages/AdminSecurityPage'
import AuthSettingsPage from './pages/AuthSettingsPage'
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
    gridTemplateColumns: '264px 1fr',
    minHeight: '100vh',
    height: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    background: 'var(--color-app-bg)',
    color: 'var(--color-text-primary)',
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  sidebar: {
    background: 'var(--color-sidebar-bg)',
    color: 'var(--color-sidebar-text)',
    padding: '1.2rem 1.05rem 1.7rem',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: '1rem',
    minHeight: '100vh',
    height: '100vh',
    boxSizing: 'border-box' as const,
    overflowY: 'hidden' as const,
    overflowX: 'visible' as const,
    width: 'fit-content',
  },
  navLinkVariants: {
    standard: (active: boolean) => ({
      padding: '0.55rem 0.85rem',
      borderRadius: 10,
      color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-sidebar-item-text)',
      background: active ? 'var(--color-sidebar-item-active-bg)' : 'var(--color-sidebar-item-bg)',
      fontWeight: active ? 600 : 500,
      textDecoration: 'none',
      transition: 'background 0.15s ease, box-shadow 0.2s ease',
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      width: '100%',
      border: '1px solid transparent',
      boxShadow: active ? '0 6px 20px -16px rgba(0, 0, 0, 0.7)' : 'none',
      boxSizing: 'border-box' as const,
    }),
    prominent: (active: boolean) => ({
      padding: '0.6rem 1rem',
      borderRadius: 12,
      color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-sidebar-text)',
      background: active ? 'var(--color-sidebar-button-active-bg)' : 'var(--color-sidebar-item-bg)',
      fontWeight: active ? 600 : 550,
      textDecoration: 'none',
      transition: 'background 0.15s ease, box-shadow 0.2s ease',
      fontSize: '0.9rem',
      boxShadow: active ? '0 0 0 1px var(--color-outline)' : '0 10px 22px -24px rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.55rem',
      width: '100%',
      border: active ? '1px solid var(--color-outline)' : '1px solid transparent',
      boxSizing: 'border-box' as const,
    }),
    button: (active: boolean) => ({
      padding: '0.65rem 1rem',
      borderRadius: 12,
      color: active ? 'var(--color-sidebar-button-active-text)' : 'var(--color-sidebar-button-text)',
      background: active ? 'var(--color-sidebar-button-active-bg)' : 'var(--color-sidebar-button-bg)',
      fontWeight: 600,
      textDecoration: 'none',
      transition: 'background 0.15s ease, box-shadow 0.2s ease',
      fontSize: '0.85rem',
      textAlign: 'center' as const,
      boxShadow: active ? '0 10px 25px -12px var(--color-outline)' : '0 12px 26px -24px rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.45rem',
      width: '100%',
      border: '1px solid transparent',
      boxSizing: 'border-box' as const,
    }),
  } as Record<'standard' | 'prominent' | 'button', (active: boolean) => React.CSSProperties>,
  content: {
    padding: '2rem 3rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
    color: 'var(--color-text-primary)',
    height: '100vh',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
}

const themeToggleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.45rem',
  borderRadius: 12,
  border: '1px solid transparent',
  background: 'var(--color-sidebar-button-bg)',
  color: 'var(--color-sidebar-button-text)',
  padding: '0.6rem 0.9rem',
  cursor: 'pointer',
  transition: 'background 0.15s ease, box-shadow 0.2s ease',
  fontSize: '0.85rem',
  fontWeight: 600,
  width: '100%',
  boxSizing: 'border-box' as const,
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
    <div style={layoutStyles.app}>
      <aside style={layoutStyles.sidebar}>
        <div style={sidebarHeaderStyle}>
          <div>
            <div style={badgeStyle}>SRE</div>
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 600 }}>SRE Toolbox</h1>
            <p style={{ margin: '0.3rem 0 0', opacity: 0.75, fontSize: '0.88rem', color: 'var(--color-sidebar-muted)' }}>
              Modular operations cockpit
            </p>
          </div>
        </div>

        <nav style={sidebarNavArea}>
          <SidebarSection title="Workspace" icon="dashboard" description="Monitor and oversee workloads">
            <SidebarLink to="/" label="Dashboard" icon="space_dashboard" end />
            <SidebarLink to="/jobs" label="Jobs" icon="work_history" />
          </SidebarSection>

          <SidebarSection title="Toolkits" icon="apps" description="Installed modules and experiences">
            {toolkits.length > 0 && <SidebarLink to="/toolkits" label="All toolkits" icon="grid_view" variant="prominent" />}
            <div style={toolkitListStyle}>
              {enabledToolkits.map((toolkit) => (
                <SidebarLink key={toolkit.slug} to={toolkit.base_path} label={toolkit.name} icon="extension" />
              ))}
              {enabledToolkits.length === 0 && !loading && (
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>No toolkits enabled.</p>
              )}
            </div>
          </SidebarSection>

          {(canAdminToolkits || canManageUsers || canManageAuth || canViewSecurity) && (
            <SidebarSection
              title="Administration"
              icon="admin_panel_settings"
              description="Configuration and access controls"
            >
              {canAdminToolkits && <SidebarLink to="/admin/toolkits" label="Toolkits" icon="tune" />}
              {canManageUsers && <SidebarLink to="/admin/users" label="Users" icon="group" />}
              {canManageAuth && <SidebarLink to="/admin/settings/auth" label="Auth settings" icon="security" />}
              {canViewSecurity && <SidebarLink to="/admin/security/audit" label="Security" icon="shield_lock" />}
            </SidebarSection>
          )}
        </nav>

        <div style={sidebarFooterArea}>
          {user && <SidebarUserCard user={user} onLogout={logout} />}
          <div style={footerControlsStyle}>
            <button
              type="button"
              onClick={toggleTheme}
              style={themeToggleStyle}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              value={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} style={{ color: 'inherit', fontSize: '1.4rem' }} />
              <span>{isDark ? 'Dark' : 'Light'} mode</span>
            </button>
            <SidebarLink to="/documentation" label="Documentation" icon="menu_book" variant="button" />
          </div>
          <div style={{ fontSize: '0.78rem', opacity: 0.75, color: 'var(--color-sidebar-muted)' }}>
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
            <Route
              path="/admin/toolkits"
              element={
                <RequireRole role="toolkit.curator">
                  <AdminToolkitsPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole role="toolkit.curator">
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings/auth"
              element={
                <RequireSuperuser>
                  <AuthSettingsPage />
                </RequireSuperuser>
              }
            />
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

type AuthenticatedUser = NonNullable<ReturnType<typeof useAuth>['user']>

function SidebarUserCard({ user, onLogout }: { user: AuthenticatedUser; onLogout: () => void | Promise<void> }) {
  const displayName = user.display_name?.trim() || user.username
  const detail = user.email || user.username
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div style={sidebarUserCardStyle}>
      <div style={sidebarUserAvatarStyle} aria-hidden>{initial}</div>
      <div style={{ display: 'grid', gap: '0.2rem', flex: 1 }}>
        <span style={{ fontWeight: 600, color: 'var(--color-sidebar-text)' }}>{displayName}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--color-sidebar-muted)' }}>{detail}</span>
      </div>
      <button type="button" onClick={() => onLogout()} style={sidebarUserButtonStyle}>
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
    <section style={sidebarSectionStyle}>
      <header style={sidebarSectionHeaderStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
          {icon && <MaterialIcon name={icon} style={{ color: 'var(--color-sidebar-muted)' }} />}
          <span>{title}</span>
        </span>
        {description && <p style={sidebarSectionDescriptionStyle}>{description}</p>}
      </header>
      <div style={{ display: 'grid', gap: '0.4rem' }}>{children}</div>
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


const sidebarFooterArea: React.CSSProperties = {
  display: 'grid',
  gap: '0.65rem',
  marginTop: 'auto',
  paddingTop: '0.55rem',
  paddingBottom: '0.1rem',
}

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.85rem',
  alignItems: 'center',
}

const sidebarNavArea: React.CSSProperties = {
  display: 'contents',
  gap: '0.95rem',
  flex: 1,
  overflowY: 'auto' as const,
  overflowX: 'hidden' as const,
  paddingRight: '0.3rem',
  marginRight: '-0.3rem',
  paddingBottom: '0.45rem',
  minHeight: 0,
}

const badgeStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: 'var(--color-sidebar-badge-bg, rgba(255, 255, 255, 0.08))',
  border: '1px solid var(--color-sidebar-badge-border, rgba(255, 255, 255, 0.12))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '1rem',
  letterSpacing: '0.08em',
  color: 'var(--color-sidebar-text)',
}

const toolkitListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.3rem',
  marginTop: '0.35rem',
  paddingLeft: '0.2rem',
}

const footerControlsStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
}

const sidebarSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
  padding: '0.68rem 0.85rem 0.82rem',
  borderRadius: 13,
  border: '1px solid var(--color-sidebar-panel-border, rgba(255, 255, 255, 0.05))',
  background: 'var(--color-sidebar-panel-bg, rgba(255, 255, 255, 0.03))',
  boxShadow: '0 16px 28px -30px rgba(0,0,0,0.6)',
  boxSizing: 'border-box' as const,
}

const sidebarSectionHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.25rem',
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-sidebar-muted)',
}

const sidebarSectionDescriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.72rem',
  color: 'var(--color-sidebar-muted)',
  textTransform: 'none',
  letterSpacing: 0,
  opacity: 0.78,
}

const sidebarUserCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 0.9rem',
  borderRadius: 12,
  border: '1px solid var(--color-sidebar-panel-border, rgba(255, 255, 255, 0.06))',
  background: 'var(--color-sidebar-panel-bg, rgba(255, 255, 255, 0.04))',
  boxShadow: '0 12px 24px -24px rgba(0,0,0,0.55)',
  boxSizing: 'border-box' as const,
}

const sidebarUserAvatarStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '0.95rem',
  color: 'var(--color-sidebar-text)',
  background: 'var(--color-sidebar-avatar-bg, rgba(255, 255, 255, 0.09))',
  border: '1px solid var(--color-sidebar-badge-border, rgba(255, 255, 255, 0.12))',
}

const sidebarUserButtonStyle: React.CSSProperties = {
  border: '1px solid transparent',
  borderRadius: 10,
  background: 'var(--color-sidebar-button-bg)',
  color: 'var(--color-sidebar-button-text)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.45rem 0.65rem',
  cursor: 'pointer',
  transition: 'background 0.15s ease, box-shadow 0.2s ease',
  boxSizing: 'border-box' as const,
}
