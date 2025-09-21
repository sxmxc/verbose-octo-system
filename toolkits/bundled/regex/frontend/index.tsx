import RegexTesterPage from './pages/RegexTesterPage'
import { getReactRouterRuntime, getReactRuntime } from './runtime'
import type { CSSProperties } from 'react'


const React = getReactRuntime()
const Router = getReactRouterRuntime()
const { NavLink, Navigate, Route, Routes } = Router


const layoutStyles = {
  wrapper: {
    background: 'var(--color-surface)',
    borderRadius: 12,
    boxShadow: 'var(--color-shadow)',
    border: '1px solid var(--color-border)',
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
    color: 'var(--color-text-primary)',
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


export default function RegexToolkitLayout() {
  return (
    <div style={layoutStyles.wrapper}>
      <header>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            data_object
          </span>
          Regex Toolkit
        </h3>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-secondary)' }}>
          Evaluate expressions, toggle flags, and inspect capture groups.
        </p>
        <aside
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 10,
            border: '1px solid var(--color-warning-border)',
            background: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}
        >
          <strong>Named groups:</strong> patterns run on Python's <code>re</code> engine. Use
          {' '}<code>(?P&lt;name&gt;...)</code> for named captures—the JavaScript-style <code>(?&lt;name&gt;...)</code>
          syntax is not supported.
        </aside>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        <NavLink end to="" style={({ isActive }) => layoutStyles.navLink(isActive)}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            find_replace
          </span>
          Playground
        </NavLink>
      </nav>

      <section>
        <Routes>
          <Route index element={<RegexTesterPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </section>
    </div>
  )
}
