import React from 'react'
import { Link } from 'react-router-dom'

import { useToolkits } from '../ToolkitContext'


const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  padding: '1.5rem',
}

export default function ToolkitIndexPage() {
  const { toolkits } = useToolkits()

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Toolkits</h3>
      <p style={{ color: '#64748b' }}>
        Explore toolbox capabilities. Each toolkit exposes its own workflows and utilities.
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {toolkits.length === 0 && <p style={{ color: '#94a3b8' }}>No toolkits registered yet.</p>}
        {[...toolkits].sort((a, b) => a.name.localeCompare(b.name)).map((toolkit) => {
          const highlights = toolkit.dashboard_cards?.map((card) => card.body) ?? defaultHighlights[toolkit.slug] ?? []
          return (
            <div key={toolkit.slug} style={toolkitCardStyle}>
              <div>
                <h4 style={{ margin: 0 }}>{toolkit.name}</h4>
                <p style={{ margin: '0.35rem 0 0', color: '#64748b' }}>{toolkit.description}</p>
                {highlights.length > 0 && (
                  <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', color: '#0f172a' }}>
                    {highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <StatusPill enabled={toolkit.enabled} />
              </div>
              <Link to={toolkit.base_path || '/toolkits'} style={toolkitLinkStyle}>
                {toolkit.enabled ? 'Open toolkit →' : 'View details →'}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}


const toolkitCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1.1rem 1.25rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
}

const toolkitLinkStyle: React.CSSProperties = {
  background: '#0ea5e9',
  color: '#0f172a',
  padding: '0.45rem 0.85rem',
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: 'none',
}

const defaultHighlights: Record<string, string[]> = {
  zabbix: ['Multiple instances', 'Self-service API credentials', 'Bulk host automation'],
  regex: ['Named group output', 'Flag toggles', 'Rapid validation'],
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        marginTop: '0.75rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        background: enabled ? '#dcfce7' : '#fee2e2',
        color: enabled ? '#166534' : '#991b1b',
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: enabled ? '#16a34a' : '#f87171' }} />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  )
}
