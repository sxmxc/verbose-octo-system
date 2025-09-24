# Toolkit Runtime Reference

This guide explains how the shared `toolkit_runtime` package wires toolkits into the SRE Toolbox host. Use it alongside `docs/toolbox-architecture.md` (component map) and `docs/runtime-architecture.md` (deployment topology) when building or debugging toolkit bundles.

## Overview

`toolkit_runtime` ships with every Toolbox deployment and is injected into the Python path for toolkits. It provides three focused helper modules:

- `toolkit_runtime.redis` – returns Redis clients and namespaced key builders that keep toolkit data isolated per installation.
- `toolkit_runtime.jobs` – persisting and querying job metadata (status, logs, payloads) in Redis.
- `toolkit_runtime.worker` – enqueueing Celery jobs, sharing the host worker, and cancelling running tasks.

These helpers are used by both toolkit bundles and the host services (`backend/app/services/jobs.py`, `backend/app/worker_client.py`) so job telemetry stays consistent regardless of where the call originates.

## Module details

### `toolkit_runtime.redis`

- `redis_url()` resolves `REDIS_URL` or falls back to Toolbox configuration (`settings.redis_url`) before using `redis://redis:6379/0`.
- `redis_prefix()` builds the namespace prefix (defaults to `sretoolbox`). Set `REDIS_PREFIX` to avoid collisions when multiple stacks share one Redis.
- `redis_key(*parts)` joins segments under the prefix, stripping stray colons. Toolkits typically call `redis_key("toolkits", <slug>, ...)` when storing state.
- `get_redis()` returns a cached `Redis` client configured for decoded responses. Call `reset_redis_client()` in tests when you need a fresh connection.

### `toolkit_runtime.jobs`

`jobs.py` stores JSON documents in a Redis hash (`JOBS_KEY`) and normalises the schema before returning results. A job record contains:

- `id` – UUID assigned on creation.
- `toolkit` / `module` – toolkit slug used for filtering.
- `operation` – logical action name provided by the caller.
- `type` – `<toolkit>.<operation>` identifier used by the worker registry.
- `payload` – user-supplied parameters serialised as JSON.
- `status` – `queued`, `running`, `succeeded`, `failed`, or `cancelled` (`TERMINAL_STATUSES` guards the last three).
- `progress` – integer percentage (helpers coerce values into range; successes default to 100%).
- `logs` – time-stamped messages appended whenever helpers call `append_log`.
- `created_at` / `updated_at` – UTC ISO-8601 timestamps maintained by `_now()`.
- `celery_task_id`, `result`, and `error` – optional bookkeeping fields.

Key helpers:

- `create_job(toolkit, operation, payload)` – inserts the normalised job document and returns it.
- `save_job(job)` – persists mutations (status, progress, logs).
- `list_jobs(limit, offset, toolkits, modules, statuses)` – filters in-memory results then applies pagination.
- `mark_cancelling(job, message)` / `mark_cancelled(job, message)` – transition jobs while recording optional log messages.
- `append_log(job, message)` – appends to the `logs` list with a fresh timestamp.

### `toolkit_runtime.worker`

This module makes toolkits first-class participants in the shared Celery worker:

- `get_celery_app()` returns the lazily initialised Celery instance. It honours `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` and falls back to `REDIS_URL`.
- `enqueue_job(toolkit, operation, payload)` stores a job record, enqueues `worker.tasks.run_job`, and links the Celery task ID via `attach_celery_task`.
- `list_job_status(...)` proxies to `jobs.list_jobs` so toolkits can offer job dashboards without duplicating logic.
- `get_job_status(job_id)` fetches a single job (or returns `{"id": ..., "status": "not_found"}`).
- `cancel_job(job_id)` transitions a job to `cancelling`, revokes the Celery task when present, and finalises the status/logs.

Celery queue selection follows the first defined environment variable in the list `[TOOLKIT_CELERY_QUEUE, CELERY_DEFAULT_QUEUE, CELERY_TASK_DEFAULT_QUEUE, CELERY_WORKER_TASK_DEFAULT_QUEUE]`. When none are set the default queue is used.

## Job execution lifecycle

1. A toolkit backend (for example `toolkits/bundled/zabbix/backend/app.py`) calls `enqueue_job("zabbix", "bulk_add_hosts", payload)`.
2. `enqueue_job` creates the job document and sends `worker.tasks.run_job` with the job ID.
3. `backend/worker/tasks.py::run_job` loads the job, flips its status to `running`, and records the first log entry.
4. The worker resolves the handler by splitting the job type (`<slug>.<operation>`) and loading the toolkit’s `register` callable if needed.
5. Handlers update the job record directly (progress, result payloads, logs). When a handler omits terminal status updates, `_finalise_job` marks it `succeeded` and forces 100% progress.
6. Failures append `Error: ...` to the log, populate `job["error"]`, and store `status="failed"`.
7. `toolkit_runtime.jobs.save_job` persists the terminal record so `/jobs` and toolkit dashboards surface the outcome.

## Registering worker handlers

Toolkit worker modules expose a `register` function that receives the Celery app and (optionally) the core `register_handler` helper from `backend/worker/tasks.py`. A typical implementation:

```python
from toolkit_runtime import jobs

JOB_TYPE = "my_toolkit.sync"


def _handle_sync(job: dict) -> dict:
    # mutate progress and logs as work advances
    job = jobs.append_log(job, "Sync started")
    job["progress"] = 50
    jobs.save_job(job)
    # perform work, capture result
    job["result"] = {"records": 10}
    job["progress"] = 100
    job["status"] = "succeeded"
    return job


def register(celery_app, register_handler=None):
    if register_handler is not None:
        register_handler(JOB_TYPE, _handle_sync)
```

Handlers receive the mutable job dictionary. They should use `jobs.save_job` after significant changes to ensure polling UIs stay current.

## Host service integration

The host re-exports the same helpers so API routes can queue and inspect jobs without special cases:

- `backend/app/services/jobs.py` wraps the job helpers, binding them to the API’s Redis configuration during each call.
- `backend/app/worker_client.py` exposes the worker helpers to FastAPI routers (including built-in `/jobs` endpoints).

Because both host and toolkit code share the same primitives, job telemetry remains consistent whether work is triggered centrally or from a toolkit bundle.

## Configuration summary

| Variable | Purpose | Default |
| --- | --- | --- |
| `REDIS_URL` | Redis connection string for jobs and toolkit caches. | `redis://redis:6379/0` |
| `REDIS_PREFIX` | Namespace prefix for keys created via `redis_key`. | `sretoolbox` |
| `CELERY_BROKER_URL` | URL used by `Celery(broker=…)`. | `REDIS_URL` fallback |
| `CELERY_RESULT_BACKEND` | Celery result backend URL. | broker fallback |
| `TOOLKIT_CELERY_QUEUE` / `CELERY_*DEFAULT_QUEUE` | Queue name for `worker.tasks.run_job`. | Celery default |

When running inside the Toolbox containers, these values are injected automatically. Standalone toolkit tests can set them in their environment or rely on the defaults.

## Examples in the repository

- `toolkits/bundled/zabbix/backend/app.py` – uses `enqueue_job` to trigger background actions from REST endpoints.
- `toolkits/bundled/zabbix/worker/tasks.py` – registers worker handlers and updates job telemetry.
- `toolkits/bundled/toolbox_health/backend/storage.py` – persists state with `toolkit_runtime.redis` helpers.

## Next steps

Pair this reference with the authoring guides in `docs/toolkit-authoring/` when designing new toolkits, and surface new runtime behaviours here so future sessions inherit the latest contracts.
