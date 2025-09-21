"""Compatibility wrapper around the shared toolkit runtime worker helpers."""

from typing import Any, Dict, Iterable, Optional, Tuple

from toolkit_runtime.worker import (
    cancel_job as runtime_cancel_job,
    enqueue_job as runtime_enqueue_job,
    get_celery_app as runtime_get_celery_app,
    get_job_status as runtime_get_job_status,
    list_job_status as runtime_list_job_status,
)


celery_app = runtime_get_celery_app()


def get_celery_app():  # pragma: no cover - simple passthrough
    """Expose the runtime Celery app."""

    return runtime_get_celery_app()


def enqueue_job(toolkit: str, operation: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return runtime_enqueue_job(toolkit, operation, payload)


def get_job_status(job_id: str) -> Dict[str, Any]:
    return runtime_get_job_status(job_id)


def list_job_status(
    limit: Optional[int] = None,
    offset: int = 0,
    toolkits: Optional[Iterable[str]] = None,
    modules: Optional[Iterable[str]] = None,
    statuses: Optional[Iterable[str]] = None,
) -> Tuple[list[Dict[str, Any]], int]:
    return runtime_list_job_status(
        limit=limit,
        offset=offset,
        toolkits=toolkits,
        modules=modules,
        statuses=statuses,
    )


def cancel_job(job_id: str) -> Optional[Dict[str, Any]]:
    return runtime_cancel_job(job_id)


__all__ = [
    "cancel_job",
    "celery_app",
    "enqueue_job",
    "get_celery_app",
    "get_job_status",
    "list_job_status",
]
