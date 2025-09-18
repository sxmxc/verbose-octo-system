import React from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import ZabbixBulkHostsPage from './pages/ZabbixBulkHostsPage'
import ZabbixOverviewPage from './pages/ZabbixOverviewPage'
import ZabbixAdministrationPage from './pages/ZabbixSettingsPage'


const toolkitStyles = {
  wrapper: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    padding: '1.5rem',
    display: 'grid',
    gap: '1.5rem',
  },
  nav: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  navLink: (active: boolean) => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    border: '1px solid #0ea5e9',
    background: active ? '#0ea5e9' : 'transparent',
    color: active ? '#0f172a' : '#0ea5e9',
    fontWeight: 600,
    textDecoration: 'none',
  }),
}


const subNav = [
  { label: 'Overview', to: '' },
  { label: 'Administration', to: 'administration' },
  { label: 'Bulk Host Actions', to: 'actions/bulk-hosts' },
]


export default function ZabbixToolkitLayout() {
  return (
    <div style={toolkitStyles.wrapper}>
      <header>
        <h3 style={{ margin: 0 }}>Zabbix Toolkit</h3>
        <p style={{ margin: '0.3rem 0 0', color: '#64748b' }}>
          Manage Zabbix API endpoints, toolkit settings, and automation actions.
        </p>
      </header>

      <nav style={toolkitStyles.nav}>
        {subNav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === ''}
            style={({ isActive }) => toolkitStyles.navLink(isActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <section>
        <Routes>
          <Route index element={<ZabbixOverviewPage />} />
          <Route path="administration" element={<ZabbixAdministrationPage />} />
          <Route path="actions/bulk-hosts" element={<ZabbixBulkHostsPage />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </section>
    </div>
  )
}
