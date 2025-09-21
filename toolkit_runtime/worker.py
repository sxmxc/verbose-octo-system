"""Celery helpers exposed to toolkits."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, Iterable, Optional, Tuple

from celery import Celery

from .jobs import (
    TERMINAL_STATUSES,
    append_log,
    attach_celery_task,
    create_job,
    get_job,
    list_jobs,
    mark_cancelled,
    mark_cancelling,
)

_DEFAULT_QUEUE_NAMES = (
    "TOOLKIT_CELERY_QUEUE",
    "CELERY_DEFAULT_QUEUE",
    "CELERY_TASK_DEFAULT_QUEUE",
    "CELERY_WORKER_TASK_DEFAULT_QUEUE",
)


def _resolve_broker() -> str:
    return os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL", "redis://redis:6379/0")


def _resolve_backend() -> str:
    return os.getenv("CELERY_RESULT_BACKEND") or _resolve_broker()


def _resolve_default_queue() -> Optional[str]:
    for env_var in _DEFAULT_QUEUE_NAMES:
        value = os.getenv(env_var)
        if value and value.strip():
            return value.strip()
    return None


def _build_send_kwargs(job_id: str) -> Dict[str, Any]:
    queue = _resolve_default_queue()
    kwargs: Dict[str, Any] = {"args": [job_id]}
    if queue:
        kwargs["queue"] = queue
    return kwargs


@lru_cache(maxsize=1)
def _create_celery_app() -> Celery:
    return Celery("sre_toolbox", broker=_resolve_broker(), backend=_resolve_backend())


def get_celery_app() -> Celery:
    """Return the shared Celery client used by toolkit runtime helpers."""

    return _create_celery_app()


def enqueue_job(toolkit: str, operation: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    job = create_job(toolkit, operation, payload)
    celery_app = get_celery_app()
    kwargs = _build_send_kwargs(job["id"])
    result = celery_app.send_task("worker.tasks.run_job", **kwargs)
    job = attach_celery_task(job, result.id)
    return job


def get_job_status(job_id: str) -> Dict[str, Any]:
    job = get_job(job_id)
    if not job:
        return {"id": job_id, "status": "not_found"}
    return job


def list_job_status(
    limit: Optional[int] = None,
    offset: int = 0,
    toolkits: Optional[Iterable[str]] = None,
    modules: Optional[Iterable[str]] = None,
    statuses: Optional[Iterable[str]] = None,
) -> Tuple[list[Dict[str, Any]], int]:
    return list_jobs(limit=limit, offset=offset, toolkits=toolkits, modules=modules, statuses=statuses)


def cancel_job(job_id: str) -> Optional[Dict[str, Any]]:
    job = get_job(job_id)
    if not job:
        return None
    if job.get("status") in TERMINAL_STATUSES:
        return job

    previous_status = job.get("status")
    job = mark_cancelling(job, "Cancellation requested")

    task_id = job.get("celery_task_id")
    if task_id:
        celery_app = get_celery_app()
        celery_app.control.revoke(task_id, terminate=True)

    if previous_status == "queued":
        job = mark_cancelled(job, "Job cancelled before execution")
    else:
        job = append_log(job, "Cancellation signal sent to worker")

    return job


__all__ = [
    "cancel_job",
    "enqueue_job",
    "get_celery_app",
    "get_job_status",
    "list_job_status",
]
