import React, { useEffect, useState } from 'react'

type Job = {
  id: string
  type: string
  status: string
  progress: number
}

export default function App() {
  const [rows, setRows] = useState([{host:'host-1', ip:'10.0.0.1', groups:[], templates:[], macros:{}}])
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)

  async function dryRun() {
    const res = await fetch('http://localhost:8080/actions/bulk-add-hosts/dry-run', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({rows, dry_run: true})
    })
    const json = await res.json()
    alert('Dry-run OK: ' + JSON.stringify(json.summary ?? json, null, 2))
  }

  async function execute() {
    const res = await fetch('http://localhost:8080/actions/bulk-add-hosts/execute', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({rows, dry_run: false})
    })
    const json = await res.json()
    setJobId(json.job_id)
  }

  useEffect(() => {
    if (!jobId) return
    const t = setInterval(async () => {
      const res = await fetch(`http://localhost:8080/jobs/${jobId}`)
      const json = await res.json()
      setJob(json)
      if (json.status === 'succeeded' || json.status === 'failed' || json.status === 'not_found') {
        clearInterval(t)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [jobId])

  return (
    <div style={{maxWidth: 900, margin: '2rem auto', fontFamily: 'ui-sans-serif'}}>
      <h1 style={{marginBottom: '0.5rem'}}>Zabbix Admin</h1>
      <p style={{opacity: 0.7, marginTop: 0}}>Bulk add hosts (demo scaffold)</p>

      <pre style={{background: '#f6f8fa', padding: '1rem', borderRadius: 8}}>
{JSON.stringify(rows, null, 2)}
      </pre>

      <div style={{display:'flex', gap: 12}}>
        <button onClick={dryRun}>Dry run</button>
        <button onClick={execute}>Execute</button>
      </div>

      {jobId && (
        <div style={{marginTop: 24}}>
          <h3>Job: {jobId}</h3>
          <pre style={{background: '#f6f8fa', padding: '1rem', borderRadius: 8}}>
{JSON.stringify(job, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
