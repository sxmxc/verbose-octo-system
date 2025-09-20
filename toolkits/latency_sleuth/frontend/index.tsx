import { getReactRuntime, getRouterRuntime } from './runtime'

import ProbeDesigner from './components/ProbeDesigner'
import JobLogViewer from './components/JobLogViewer'
import LatencyHeatmapView from './components/LatencyHeatmap'

const React = getReactRuntime()
const Router = getRouterRuntime()
const { NavLink, Navigate, Route, Routes } = Router

const navItems = [
  { label: 'Designer', path: '', icon: 'draw', exact: true },
  { label: 'Job Logs', path: 'jobs', icon: 'receipt_long', exact: false },
  { label: 'Heatmap', path: 'heatmap', icon: 'grid_view', exact: false },
]

const navStyle = {
  wrapper: {
    padding: '1.5rem',
    display: 'grid',
    gap: '1.25rem',
    color: 'var(--color-text-primary)',
  },
  nav: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  navLink(active: boolean) {
    return {
      padding: '0.5rem 0.85rem',
      borderRadius: 8,
      border: '1px solid var(--color-border)',
      textDecoration: 'none',
      background: active ? 'var(--color-accent)' : 'transparent',
      color: active ? 'var(--color-sidebar-item-active-text)' : 'var(--color-link)',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
    }
  },
}

export default function LatencySleuthApp() {
  return (
    <div className="tk-card" style={navStyle.wrapper}>
      <header>
        <h2 style={{ margin: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="material-symbols-outlined" aria-hidden>
            speed
          </span>
          Latency Sleuth
        </h2>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)' }}>
          Synthetic probes purpose-built for latency investigations and SLA validation.
        </p>
      </header>

      <nav style={navStyle.nav}>
        {navItems.map((item) => (
          <NavLink key={item.label} to={item.path} end={item.exact} style={({ isActive }) => navStyle.navLink(isActive)}>
            <span className="material-symbols-outlined" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <section>
        <Routes>
          <Route index element={<ProbeDesigner />} />
          <Route path="jobs" element={<JobLogViewer />} />
          <Route path="heatmap" element={<LatencyHeatmapView />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </section>
    </div>
  )
}
