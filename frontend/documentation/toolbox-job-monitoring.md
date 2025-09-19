# Toolbox Job Monitoring

The job system provides visibility into work orchestrated by toolkit workers. Use this guide to understand how metrics flow from task code to the dashboard and how operators can triage failures.

## Jobs Dashboard Overview

- Access **Workspace → Jobs** to view running and historical jobs.
- Filter by toolkit slug (`?toolkit=<slug>`) to focus on a specific integration.
- Columns highlight the latest status, percent complete, and timestamps so you can quickly spot failed or stalled jobs.

## Emitting Progress From Tasks

Inside worker code (see [Toolkit Worker Guide](toolkit-worker)) push progress updates as your job advances:

```python
from app.worker.progress import TaskProgress

async def import_hosts(job_id: str, payload: dict) -> None:
    TaskProgress.push(job_id, 10, "Fetched inventory from CMDB")
    # ... perform work ...
    TaskProgress.push(job_id, 65, "Provisioned 10 hosts in Zabbix")
    # ... wrap up ...
```

The dashboard reflects these updates instantly, giving operators confidence that long-running automations are still progressing.

## Handling Failures

- Raise exceptions with descriptive messages—these are surfaced directly on the job row.
- Provide remediation steps or error codes in the message so operators know how to respond.
- Document recovery runbooks alongside the relevant toolkit guide.

## Auditing History

- Jobs are persisted in the Toolbox datastore. Use API queries (`GET /jobs`) to export history or build custom reports.
- Correlate job IDs with external systems (ticket numbers, change requests) for traceability.

## Building Alerts

- Poll the `/jobs` API or subscribe to worker events to detect repeated failures.
- Combine with observability tooling (PagerDuty, Slack, etc.) to alert on specific status transitions.

Next, explore the [Examples](examples-basic-toolkit) section to see how sample toolkits publish progress and surface results.
