import React from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import RegexTesterPage from './pages/RegexTesterPage'


const layoutStyles = {
  wrapper: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
  },
  navLink: (active: boolean) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    border: '1px solid #7c3aed',
    background: active ? '#7c3aed' : 'transparent',
    color: active ? '#f8fafc' : '#7c3aed',
    fontWeight: 600,
    textDecoration: 'none',
  }),
}


export default function RegexToolkitLayout() {
  return (
    <div style={layoutStyles.wrapper}>
      <header>
        <h3 style={{ margin: 0 }}>Regex Toolkit</h3>
        <p style={{ margin: '0.3rem 0 0', color: '#64748b' }}>
          Evaluate expressions, toggle flags, and inspect capture groups.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        <NavLink end to="" style={({ isActive }) => layoutStyles.navLink(isActive)}>
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
