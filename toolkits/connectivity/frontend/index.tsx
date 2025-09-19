import type { CSSProperties } from 'react'

import { getReactRuntime, getReactRouterRuntime } from './runtime'

import ConnectivityOverviewPage from './pages/ConnectivityOverviewPage'
import TargetsPage from './pages/TargetsPage'
import AdhocCheckPage from './pages/AdhocCheckPage'

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
}

const iconStyle: CSSProperties = {
  fontSize: '1.15rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}

const navItems = [
  { label: 'Overview', to: '', icon: 'dashboard', exact: true },
  { label: 'Targets', to: 'targets', icon: 'hub', exact: false },
  { label: 'Ad-hoc Check', to: 'adhoc', icon: 'quick_reference', exact: false },
]

export default function ConnectivityToolkitLayout() {
  return (
    <div className="tk-card" style={layoutStyles.wrapper}>
      <header>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            cell_tower
          </span>
          Bulk Connectivity Checker
        </h3>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' }}>
          Probe large host lists, monitor reachability, and dispatch remediation jobs.
        </p>
      </header>

      <nav style={layoutStyles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.exact}
            style={({ isActive }) => layoutStyles.navLink(isActive)}
          >
            <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <section>
        <Routes>
          <Route index element={<ConnectivityOverviewPage />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="adhoc" element={<AdhocCheckPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </section>
    </div>
  )
}
