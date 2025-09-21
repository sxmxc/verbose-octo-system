"""Shim module re-exporting the shared toolkit runtime job helpers."""

from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable

from toolkit_runtime import jobs as _runtime_jobs
from toolkit_runtime.redis import get_redis as _get_redis


JOBS_KEY = _runtime_jobs.JOBS_KEY
TERMINAL_STATUSES = _runtime_jobs.TERMINAL_STATUSES


@contextmanager
def _bind_runtime_redis() -> None:
    original = _runtime_jobs.get_redis
    _runtime_jobs.get_redis = get_redis
    try:
        yield
    finally:  # pragma: no cover - best-effort restoration
        _runtime_jobs.get_redis = original


def _with_runtime_binding(func: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(func)
    def wrapper(*args, **kwargs):
        with _bind_runtime_redis():
            return func(*args, **kwargs)

    return wrapper


@_with_runtime_binding
def create_job(toolkit: str, operation: str, payload: dict) -> dict:
    return _runtime_jobs.create_job(toolkit, operation, payload)


@_with_runtime_binding
def save_job(job: dict, *, update_timestamp: bool = True) -> None:
    return _runtime_jobs.save_job(job, update_timestamp=update_timestamp)


@_with_runtime_binding
def get_job(job_id: str) -> dict | None:
    return _runtime_jobs.get_job(job_id)


@_with_runtime_binding
def list_jobs(
    limit: int | None = None,
    offset: int = 0,
    toolkits: Any = None,
    modules: Any = None,
    statuses: Any = None,
):
    return _runtime_jobs.list_jobs(
        limit=limit,
        offset=offset,
        toolkits=toolkits,
        modules=modules,
        statuses=statuses,
    )


@_with_runtime_binding
def delete_job(job_id: str) -> bool:
    return _runtime_jobs.delete_job(job_id)


@_with_runtime_binding
def append_log(job: dict, message: str) -> dict:
    return _runtime_jobs.append_log(job, message)


@_with_runtime_binding
def attach_celery_task(job: dict, task_id: str) -> dict:
    return _runtime_jobs.attach_celery_task(job, task_id)


@_with_runtime_binding
def mark_cancelled(job: dict, message: str | None = None) -> dict:
    return _runtime_jobs.mark_cancelled(job, message)


@_with_runtime_binding
def mark_cancelling(job: dict, message: str | None = None) -> dict:
    return _runtime_jobs.mark_cancelling(job, message)


get_redis = _get_redis


# Legacy helpers retained for tests/compatibility
_dump = _runtime_jobs._dump
_load = _runtime_jobs._load
_normalise = _runtime_jobs._normalise

__all__ = [
    "JOBS_KEY",
    "TERMINAL_STATUSES",
    "append_log",
    "attach_celery_task",
    "create_job",
    "delete_job",
    "get_job",
    "list_jobs",
    "mark_cancelled",
    "mark_cancelling",
    "save_job",
    "_dump",
    "_load",
    "_normalise",
    "get_redis",
]
