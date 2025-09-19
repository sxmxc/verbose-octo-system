from __future__ import annotations

from typing import Callable, Dict

from app.services import jobs as job_store
from app.toolkit_loader import load_toolkit_workers, mark_toolkit_removed

from .celery_app import celery_app


JobHandler = Callable[[dict], dict]

# Registered job handlers keyed by toolkit.operation
_HANDLERS: Dict[str, JobHandler] = {}


def register_handler(job_type: str, handler: JobHandler) -> None:
    """Register a handler for a toolkit job type."""
    _HANDLERS[job_type] = handler


def unregister_handler(job_type: str) -> None:
    _HANDLERS.pop(job_type, None)


def get_handler(job_type: str) -> JobHandler | None:
    return _HANDLERS.get(job_type)


def _ensure_handler(job_type: str) -> JobHandler | None:
    handler = get_handler(job_type)
    if handler:
        return handler

    if not job_type:
        return None

    slug = job_type.split(".", 1)[0]
    if not slug:
        return None

    # Allow re-importing toolkits that were previously loaded
    mark_toolkit_removed(slug)
    load_toolkit_workers(celery_app, slugs={slug})
    return get_handler(job_type)


@celery_app.task(name="worker.tasks.run_job")
def run_job(job_id: str):
    job = job_store.get_job(job_id)
    if not job:
        return

    if job.get("status") == "cancelling":
        job_store.mark_cancelled(job, "Cancellation acknowledged before execution")
        return
    if job.get("status") == "cancelled":
        return

    job["status"] = "running"
    job["progress"] = 0
    job_store.save_job(job)
    job = job_store.append_log(job, "Job execution started")

    job_type = job.get("type")
    handler = _ensure_handler(job_type)

    try:
        if not handler:
            raise ValueError(f"No handler registered for job type {job_type}")
        job = handler(job)
    except Exception as exc:
        job["status"] = "failed"
        job = job_store.append_log(job, f"Error: {exc}")
        job["error"] = str(exc)
    finally:
        job_store.save_job(job)
