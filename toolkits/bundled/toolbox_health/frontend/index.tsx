import type { CSSProperties } from 'react'

import { getReactRuntime, getReactRouterRuntime } from './runtime'
import OverviewPage from './pages/OverviewPage'

const React = getReactRuntime()
const ReactRouterDom = getReactRouterRuntime()
const { NavLink, Navigate, Route, Routes } = ReactRouterDom

const layoutStyles = {
  wrapper: {
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
    color: 'var(--color-text-primary)',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  navLink: (active: boolean) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-accent)' : 'transparent',
    color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-link)',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  }),
} satisfies Record<string, CSSProperties | ((active: boolean) => CSSProperties)>

const iconStyle: CSSProperties = {
  fontSize: '1.15rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

export default function ToolboxHealthToolkitLayout() {
  return (
    <div className="tk-card" style={layoutStyles.wrapper}>
      <header>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            stethoscope
          </span>
          Toolbox Health
        </h3>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' }}>
          Monitor the vitality of the Toolbox frontend, backend, and worker services.
        </p>
      </header>

      <nav style={layoutStyles.nav} aria-label="Toolbox health views">
        <NavLink end to="" style={({ isActive }) => layoutStyles.navLink(isActive)}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            dashboard
          </span>
          Overview
        </NavLink>
      </nav>

      <section>
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </section>
    </div>
  )
}

