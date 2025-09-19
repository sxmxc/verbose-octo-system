# Toolkit Worker Guide

Toolkit workers execute asynchronous and long-running tasks. They integrate with the SRE Toolbox job orchestration layer and surface progress in the shared Jobs dashboard. Treat them as the automation backbone that complements your HTTP routes and UI flows.

## Anatomy

- `worker/tasks.py`: Celery task definitions and job orchestration helpers.
- `worker/__init__.py`: optional bootstrap logic for registering task modules.
- `toolkit.json`: declare worker entry points so the runtime can import your tasks.

## Authoring Tasks

1. Design idempotent tasks so retries are safe.
2. Accept serialisable payloads; the runtime marshals JSON through the job queue.
3. Use `from app.worker.context import get_logger` (or a helper you expose under `worker/`) to emit structured logs.
4. Wrap integrations in try/except blocks and raise descriptive errors—these bubble into job status updates.

## Progress & Results

- Publish progress via `TaskProgress.push(job_id, percent, message)` to keep operators informed.
- Store result artefacts in object storage or the toolkit database and link them in the job payload.

## Triggering Work

- Expose HTTP endpoints in the toolkit [Toolkit](toolkit) backend to enqueue tasks.
- UIs can call `apiFetch('/jobs', { method: 'POST', body })` to trigger work.
- Command-line automation can target the same endpoints for scripted workflows.

## Testing & Simulation

- Use Celery’s eager mode for unit tests to exercise tasks synchronously.
- Seed fixtures in `worker/tests/` and document expected inputs/outputs.

Head back to [Toolkit UI Guide](toolkit-ui) to connect your jobs to operator-facing experiences, or revisit [Toolbox Job Monitoring](toolbox-job-monitoring) to see how progress appears in the shell.
