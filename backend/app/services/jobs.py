from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from ..core.redis import get_redis, redis_key


JOBS_KEY = redis_key("jobs")
TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dump(job: Dict[str, Any]) -> str:
    return json.dumps(job)


def _load(raw: str) -> Dict[str, Any]:
    return json.loads(raw)


def _normalise(job: Dict[str, Any]) -> Dict[str, Any]:
    job.setdefault("logs", [])
    job.setdefault("result", None)
    job.setdefault("error", None)
    job.setdefault("progress", 0)
    job.setdefault("status", "queued")
    job.setdefault("celery_task_id", None)
    job.setdefault("created_at", _now())
    job.setdefault("updated_at", job["created_at"])
    return job


def create_job(toolkit: str, operation: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    job_id = str(uuid4())
    now = _now()
    job = _normalise(
        {
            "id": job_id,
            "toolkit": toolkit,
            "module": toolkit,
            "operation": operation,
            "type": f"{toolkit}.{operation}",
            "payload": payload,
            "status": "queued",
            "progress": 0,
            "logs": [],
            "created_at": now,
            "updated_at": now,
        }
    )
    redis = get_redis()
    redis.hset(JOBS_KEY, job_id, _dump(job))
    return job


def save_job(job: Dict[str, Any]) -> None:
    job["updated_at"] = _now()
    redis = get_redis()
    redis.hset(JOBS_KEY, job["id"], _dump(job))


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    redis = get_redis()
    raw = redis.hget(JOBS_KEY, job_id)
    if not raw:
        return None
    job = _normalise(_load(raw))
    return job


def list_jobs(limit: Optional[int] = None, toolkits: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    redis = get_redis()
    values = redis.hvals(JOBS_KEY)
    jobs = [_normalise(_load(raw)) for raw in values]
    if toolkits:
        toolkits_set = {m.lower() for m in toolkits}
        jobs = [
            job
            for job in jobs
            if (job.get("toolkit") or job.get("module", "")).lower() in toolkits_set
        ]
    jobs.sort(key=lambda job: job.get("created_at", ""), reverse=True)
    if limit is not None:
        return jobs[:limit]
    return jobs


def append_log(job: Dict[str, Any], message: str) -> Dict[str, Any]:
    logs = job.setdefault("logs", [])
    logs.append({"ts": _now(), "message": message})
    save_job(job)
    return job


def delete_job(job_id: str) -> bool:
    redis = get_redis()
    return bool(redis.hdel(JOBS_KEY, job_id))


def attach_celery_task(job: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    job["celery_task_id"] = task_id
    save_job(job)
    return job


def mark_cancelled(job: Dict[str, Any], message: str | None = None) -> Dict[str, Any]:
    job["status"] = "cancelled"
    job.setdefault("progress", 0)
    if message:
        job = append_log(job, message)
    else:
        save_job(job)
    return job


def mark_cancelling(job: Dict[str, Any], message: str | None = None) -> Dict[str, Any]:
    job["status"] = "cancelling"
    if message:
        job = append_log(job, message)
    else:
        save_job(job)
    return job
