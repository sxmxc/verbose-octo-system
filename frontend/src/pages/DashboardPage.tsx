import React, { useCallback, useEffect, useState } from 'react'

import { apiFetch } from '../api'
import { Job } from '../types'


type DashboardCardMetric = {
  label: string
  value: string | number
  description?: string
}

type DashboardCard = {
  toolkit: string
  title: string
  body: string
  link_text?: string
  link_href?: string
  icon?: string
  metrics?: DashboardCardMetric[]
}

type DashboardData = {
  jobs: {
    recent: Job[]
    totals: {
      count: number
      by_status: Record<string, number>
    }
  }
  cards?: DashboardCard[]
}


const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  padding: '1.5rem',
}

const summaryPillStyle = (accent: string): React.CSSProperties => ({
  minWidth: '160px',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  background: accent,
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
})


export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<DashboardData>('/dashboard')
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Dashboard</h3>
        <button onClick={load} style={{ padding: '0.4rem 0.9rem' }}>
          Refresh
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {data && (
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
          {data.cards && data.cards.length > 0 && (
            <section>
              <h4 style={{ margin: '0 0 0.75rem' }}>Toolkit highlights</h4>
              <div
                style={{
                  display: 'grid',
                  gap: '0.9rem',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  alignItems: 'stretch',
                }}
              >
                {data.cards.map((card, idx) => (
                  <div
                    key={`${card.toolkit}-${idx}`}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '0.9rem 1rem',
                      background: '#f8fafc',
                      display: 'grid',
                      gap: '0.55rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {card.toolkit}
                        </div>
                        <strong style={{ display: 'block', marginTop: '0.15rem', fontSize: '1rem' }}>{card.title}</strong>
                      </div>
                      {card.link_href && (
                        <a
                          href={card.link_href}
                          style={{
                            color: '#0284c7',
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            padding: '0.3rem 0.55rem',
                            borderRadius: 6,
                            background: '#e0f2fe',
                            fontWeight: 600,
                          }}
                        >
                          {card.link_text || 'Open toolkit'}
                        </a>
                      )}
                    </div>

                    {card.metrics && card.metrics.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gap: '0.6rem',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          background: '#fff',
                          borderRadius: 8,
                          padding: '0.5rem 0.6rem',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {card.metrics.map((metric, metricIdx) => (
                          <div
                            key={`${metric.label}-${metricIdx}`}
                            style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}
                          >
                            <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {metric.label}
                            </span>
                            <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{metric.value}</strong>
                            {metric.description && (
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{metric.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 style={{ margin: '0 0 0.75rem' }}>Recent Jobs</h4>
            {data.jobs.recent.length === 0 ? (
              <p style={{ margin: 0 }}>No jobs in the last window.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                      <th style={{ padding: '0.5rem' }}>Toolkit</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.recent.map((job) => {
                      const toolkitLabel = job.toolkit || job.module || 'unknown'
                      return (
                        <tr key={job.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <strong>{toolkitLabel}</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{job.operation}</div>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{job.status}</td>
                        <td>{job.progress ?? 0}%</td>
                        <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 style={{ margin: '0 0 0.75rem' }}>Job Totals</h4>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={summaryPillStyle('#1d4ed8')}>
                <span>Total</span>
                <strong>{data.jobs.totals.count}</strong>
              </div>
              {Object.entries(data.jobs.totals.by_status).map(([status, count]) => (
                <div key={status} style={summaryPillStyle('#0891b2')}>
                  <span style={{ textTransform: 'capitalize' }}>{status}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
