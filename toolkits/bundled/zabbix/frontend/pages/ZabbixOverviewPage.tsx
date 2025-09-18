import React, { useEffect, useState } from 'react'

import { apiFetch } from '../runtime'
import type { Job, ZabbixInstance } from './types'


type JobsSummaryResponse = {
  jobs: Job[]
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
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {loading && <p>Loading overview…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      <section>
        <h4 style={{ margin: 0 }}>Configured Instances</h4>
        <p style={{ margin: '0.25rem 0 1rem', color: '#64748b' }}>
          {instances.length} active instance{instances.length === 1 ? '' : 's'}.
        </p>
        {instances.length === 0 ? (
          <p>No instances defined. Add one in the Settings tab.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
            {instances.map((instance) => (
              <li key={instance.id} style={instanceCardStyle}>
                <div>
                  <strong>{instance.name}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{instance.base_url}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                  <div>Created: {new Date(instance.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(instance.updated_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 style={{ margin: 0 }}>Recent Jobs</h4>
        <p style={{ margin: '0.25rem 0 1rem', color: '#64748b' }}>
          Last 5 Zabbix job executions.
        </p>
        {recentJobs.length === 0 ? (
          <p>No recent jobs.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                <th style={{ padding: '0.5rem' }}>Operation</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.5rem' }}>{job.operation}</td>
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
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '0.9rem 1.1rem',
  background: '#f8fafc',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
