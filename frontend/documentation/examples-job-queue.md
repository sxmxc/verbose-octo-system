# Example: Queueing Background Work

This example demonstrates how a toolkit enqueues a Celery job, reports progress, and exposes results in the UI.

## Worker Task

`worker/tasks.py`

```python
from app.worker.progress import TaskProgress
from time import sleep

async def bulk_ping(job_id: str, hosts: list[str]) -> dict[str, str]:
    results: dict[str, str] = {}
    total = len(hosts) or 1

    for index, host in enumerate(hosts, start=1):
        TaskProgress.push(job_id, int(index / total * 100), f"Pinging {host}")
        sleep(0.5)
        results[host] = "reachable"

    return results
```

## Backend Route

`backend/routes.py`

```python
from fastapi import APIRouter
from app.worker.enqueue import enqueue_toolkit_job

router = APIRouter(prefix="/network", tags=["network"])

@router.post("/bulk-ping")
async def bulk_ping(hosts: list[str]) -> dict[str, str]:
    job = await enqueue_toolkit_job(
        toolkit_slug="network",
        operation="bulk-ping",
        task="worker.tasks.bulk_ping",
        payload={"hosts": hosts},
    )
    return {"job_id": job.id}
```

## UI Page

`frontend/pages/BulkPingPage.tsx`

```tsx
import React from 'react'
import { useState } from 'react'
import { apiFetch } from '../runtime'

export default function BulkPingPage() {
  const [hosts, setHosts] = useState('web-1\nweb-2')
  const [jobId, setJobId] = useState<string | null>(null)

  async function submit() {
    const payload = hosts.split(/\s+/).filter(Boolean)
    const response = await apiFetch<{ job_id: string }>(
      '/toolkits/network/network/bulk-ping',
      { method: 'POST', body: JSON.stringify(payload) }
    )
    setJobId(response.job_id)
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 420 }}>
      <textarea value={hosts} onChange={(event) => setHosts(event.target.value)} rows={5} />
      <button type="button" onClick={submit}>
        Enqueue bulk ping
      </button>
      {jobId && (
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Job created. Track progress on <a href="/jobs" style={{ color: 'var(--color-link)' }}>Jobs</a>.
        </p>
      )}
    </div>
  )
}
```

## Watching Progress

- Open **Workspace → Jobs** and filter by `toolkit=network`.
- Observe the progress updates added in the worker task.
- Build a richer dashboard by polling `/jobs/<id>` from the UI if you need live updates.

Use this example as a foundation for more complex automations. Combine it with the styling guidance in [Toolkit UI Guide](toolkit-ui) and the operational practices in [Toolbox Job Monitoring](toolbox-job-monitoring).
