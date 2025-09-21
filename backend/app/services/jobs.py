"""Shim module re-exporting the shared toolkit runtime job helpers."""

from toolkit_runtime import jobs as _runtime_jobs
from toolkit_runtime.redis import get_redis as _get_redis

# Public helpers
from toolkit_runtime.jobs import (  # noqa: F401
    JOBS_KEY,
    TERMINAL_STATUSES,
    append_log,
    attach_celery_task,
    create_job,
    delete_job,
    get_job,
    list_jobs,
    mark_cancelled,
    mark_cancelling,
    save_job,
)

# Legacy private helpers used by existing tests
_dump = _runtime_jobs._dump
_load = _runtime_jobs._load
_normalise = _runtime_jobs._normalise
get_redis = _get_redis

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
