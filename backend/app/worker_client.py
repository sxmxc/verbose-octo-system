from typing import Any, Dict, Iterable, Optional

from celery import Celery

from .config import settings
from .services import jobs as job_store


celery_app = Celery("sre_toolbox", broker=settings.redis_url, backend=settings.redis_url)


def enqueue_job(toolkit: str, operation: str, payload: dict) -> Dict[str, Any]:
    job = job_store.create_job(toolkit, operation, payload)
    result = celery_app.send_task("worker.tasks.run_job", args=[job["id"]])
    job = job_store.attach_celery_task(job, result.id)
    return job


def get_job_status(job_id: str) -> dict:
    job = job_store.get_job(job_id)
    if not job:
        return {"id": job_id, "status": "not_found"}
    return job


def list_job_status(limit: Optional[int] = None, toolkits: Optional[Iterable[str]] = None) -> list[dict]:
    return job_store.list_jobs(limit=limit, toolkits=toolkits)


def cancel_job(job_id: str) -> Optional[Dict[str, Any]]:
    job = job_store.get_job(job_id)
    if not job:
        return None
    if job.get("status") in job_store.TERMINAL_STATUSES:
        return job

    previous_status = job.get("status")
    job = job_store.mark_cancelling(job, "Cancellation requested")

    task_id = job.get("celery_task_id")
    if task_id:
        celery_app.control.revoke(task_id, terminate=True)

    if previous_status == "queued":
        job = job_store.mark_cancelled(job, "Job cancelled before execution")
    else:
        job = job_store.append_log(job, "Cancellation signal sent to worker")

    return job
