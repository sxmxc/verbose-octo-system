import React, { useEffect, useState } from 'react'

import { apiFetch } from '../runtime'
import type { Job, ZabbixInstance } from './types'


type JobsSummaryResponse = {
  jobs: Job[]
}

const iconStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
  color: 'var(--color-link)',
}


export default function ZabbixOverviewPage() {
  const [instances, setInstances] = useState<ZabbixInstance[]>([])
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [instancesRes, jobsRes] = await Promise.all([
          apiFetch<ZabbixInstance[]>('/toolkits/zabbix/instances'),
          apiFetch<JobsSummaryResponse>('/jobs?toolkit=zabbix'),
        ])
        if (!cancelled) {
          setInstances(instancesRes)
          setRecentJobs(jobsRes.jobs.slice(0, 5))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={{ display: 'grid', gap: '1.5rem', color: 'var(--color-text-primary)' }}>
      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading overview…</p>}
      {error && <p style={{ color: 'var(--color-danger-border)' }}>{error}</p>}

      <section>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
            storage
          </span>
          Configured Instances
        </h4>
        <p style={{ margin: '0.25rem 0 1rem', color: 'var(--color-text-secondary)' }}>
          {instances.length} active instance{instances.length === 1 ? '' : 's'}.
        </p>
        {instances.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No instances defined. Add one in the Settings tab.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
            {instances.map((instance) => (
              <li key={instance.id} style={instanceCardStyle}>
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-accent)' }} aria-hidden>
                      dns
                    </span>
                    <strong>{instance.name}</strong>
                  </span>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{instance.base_url}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  <div>Created: {new Date(instance.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(instance.updated_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="material-symbols-outlined" style={{ ...iconStyle, color: 'var(--color-link)' }} aria-hidden>
            work_history
          </span>
          Recent Jobs
        </h4>
        <p style={{ margin: '0.25rem 0 1rem', color: 'var(--color-text-secondary)' }}>
          Last 5 Zabbix job executions.
        </p>
        {recentJobs.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No recent jobs.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--color-surface-alt)' }}>
                <th style={{ padding: '0.5rem' }}>Operation</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span className="material-symbols-outlined" style={iconStyle} aria-hidden>
                      integration_instructions
                    </span>
                    {job.operation}
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{job.status}</td>
                  <td>{job.progress}%</td>
                  <td>{job.updated_at ? new Date(job.updated_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}


const instanceCardStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '0.9rem 1.1rem',
  background: 'var(--color-surface-alt)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
