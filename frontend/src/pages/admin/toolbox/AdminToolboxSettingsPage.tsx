import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { MaterialIcon } from '../../../components/MaterialIcon'
import '../../AdminToolkitsPage.css'

const tabs = [
  { to: '/admin/settings/toolbox', label: 'Catalog', icon: 'public', end: true },
  { to: '/admin/settings/toolbox/auth', label: 'Auth settings', icon: 'security' },
]

export default function AdminToolboxSettingsPage() {
  return (
    <div className="admin-toolkits admin-toolkits--layout">
      <header className="admin-toolkits__layout-header">
        <h3>
          <MaterialIcon name="settings" style={{ color: 'var(--color-link)' }} />
          Toolbox settings
        </h3>
        <p>Manage framework-wide configuration for the SRE Toolbox platform.</p>
      </header>

      <nav className="admin-toolkits__tabs" aria-label="Toolbox settings sections">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              ['admin-toolkits__tab', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
            }
          >
            <MaterialIcon name={tab.icon} style={{ fontSize: '1.1rem', color: 'inherit' }} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-toolkits__panel">
        <Outlet />
      </div>
    </div>
  )
}
