from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Sequence

from app.services import jobs as job_store

from backend.models import utcnow
from backend.probes import execute_probe
from backend.storage import (
    bootstrap_schedule,
    get_template,
    list_due_templates,
    record_probe_result,
    reserve_template_for_run,
)

JobPayload = Dict[str, Any]
JobRecord = Dict[str, Any]
JobHandler = Callable[[JobRecord], JobRecord]


SCHEDULE_INTERVAL_SECONDS = 30
DEFAULT_SCHEDULE_SAMPLE_SIZE = 3
STALE_JOB_GRACE_SECONDS = 120

_scheduler_registered = False
_scheduler_thread: threading.Thread | None = None
_scheduler_lock = threading.Lock()

logger = logging.getLogger(__name__)


def _normalise_overrides(payload: JobPayload) -> Sequence[float] | None:
    overrides = payload.get("latency_overrides")
    if overrides is None:
        return None
    if not isinstance(overrides, Iterable) or isinstance(overrides, (str, bytes)):
        raise ValueError("latency_overrides must be a sequence of numbers")
    result: List[float] = []
    for item in overrides:
        try:
            result.append(float(item))
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise ValueError("latency_overrides must be numeric") from exc
    return result


def _handle_run_probe(job: JobRecord) -> JobRecord:
    payload = job.get("payload", {})
    template_id = payload.get("template_id")
    if not template_id:
        raise ValueError("template_id is required")

    template = get_template(template_id)
    if not template:
        raise ValueError(f"Probe template {template_id} not found")

    sample_size = payload.get("sample_size") or 3
    try:
        sample_size = int(sample_size)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise ValueError("sample_size must be an integer") from exc
    if sample_size <= 0:
        raise ValueError("sample_size must be positive")

    overrides = _normalise_overrides(payload)

    job = job_store.append_log(job, f"Running latency probe '{template.name}' ({sample_size} samples)")

    summary = execute_probe(template, sample_size=sample_size, overrides=overrides)

    total_samples = max(len(summary.samples), 1)
    for idx, sample in enumerate(summary.samples, start=1):
        current = job_store.get_job(job["id"])
        if current and current.get("status") == "cancelling":
            return job_store.mark_cancelled(current, "Probe cancellation requested; stopping remaining samples")

        job["progress"] = int(idx / total_samples * 100)
        job = job_store.append_log(
            job,
            f"Attempt {sample.attempt}: {sample.latency_ms:.2f} ms — {'BREACH' if sample.breach else 'OK'}",
        )
        job_store.save_job(job)

    record_probe_result(summary)

    if summary.notified_channels:
        channels = ", ".join(summary.notified_channels)
        job = job_store.append_log(job, f"Notifications dispatched to: {channels}")

    job["status"] = "succeeded"
    job["progress"] = 100
    job["result"] = summary.model_dump(mode="json")
    job_store.save_job(job)
    return job


def _has_active_job(template_id: str) -> bool:
    for candidate in job_store.list_jobs(limit=200, toolkits=["latency-sleuth"]):
        if candidate.get("type") != "latency-sleuth.run_probe":
            continue
        payload = candidate.get("payload") or {}
        if payload.get("template_id") != template_id:
            continue
        if candidate.get("status") not in job_store.TERMINAL_STATUSES:
            return True
    return False


def _dispatch_due_probes(celery_app, *, now=None) -> None:
    timestamp = now or utcnow()
    for template in list_due_templates(now=timestamp):
        if _has_active_job(template.id):
            continue
        reserved = reserve_template_for_run(template.id, now=timestamp)
        if not reserved:
            continue
        job = job_store.create_job(
            "latency-sleuth",
            "run_probe",
            {
                "template_id": template.id,
                "sample_size": DEFAULT_SCHEDULE_SAMPLE_SIZE,
                "latency_overrides": None,
            },
        )
        job = job_store.append_log(job, "Scheduled run enqueued by Latency Sleuth interval")
        queue = celery_app.conf.task_default_queue or "celery"
        try:
            task = celery_app.tasks.get("worker.tasks.run_job")
            if task is not None:
                result = task.apply_async(args=[job["id"]], queue=queue)
            else:  # pragma: no cover - defensive
                result = celery_app.send_task("worker.tasks.run_job", args=[job["id"]], queue=queue)
        except Exception as exc:  # pragma: no cover - defensive guard
            job["status"] = "failed"
            job["error"] = str(exc)
            job_store.append_log(job, f"Error dispatching scheduled run: {exc}")
            job_store.save_job(job)
            logger.exception("latency-sleuth scheduler failed to dispatch run for template %s", template.id)
            continue
        job_store.attach_celery_task(job, result.id)
        job_store.append_log(job, f"Scheduled job submitted to worker task {result.id}")


def _parse_timestamp(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:  # pragma: no cover - defensive
            return None
    return None


def _resubmit_stale_jobs(celery_app, *, now=None) -> None:
    timestamp = now or utcnow()
    for job in job_store.list_jobs(limit=200, toolkits=["latency-sleuth"]):
        if job.get("type") != "latency-sleuth.run_probe":
            continue
        if job.get("status") != "queued":
            continue
        updated_at = _parse_timestamp(job.get("updated_at"))
        if not updated_at:
            continue
        if (timestamp - updated_at).total_seconds() < STALE_JOB_GRACE_SECONDS:
            continue

        queue = celery_app.conf.task_default_queue or "celery"
        try:
            task = celery_app.tasks.get("worker.tasks.run_job")
            if task is not None:
                result = task.apply_async(args=[job["id"]], queue=queue)
            else:  # pragma: no cover - defensive
                result = celery_app.send_task("worker.tasks.run_job", args=[job["id"]], queue=queue)
        except Exception as exc:  # pragma: no cover - defensive guard
            job["status"] = "failed"
            job["error"] = str(exc)
            job_store.append_log(job, f"Error resubmitting scheduled run: {exc}")
            job_store.save_job(job)
            logger.exception("latency-sleuth scheduler failed to resubmit job %s", job.get("id"))
            continue

        job_store.attach_celery_task(job, result.id)
        job_store.append_log(job, f"Resubmitted queued probe to worker task {result.id}")


def _scheduler_loop(celery_app) -> None:
    logger.info("latency-sleuth scheduler loop started")
    while True:
        try:
            _resubmit_stale_jobs(celery_app)
            _dispatch_due_probes(celery_app)
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("latency-sleuth scheduler tick failed: %s", exc)
        time.sleep(SCHEDULE_INTERVAL_SECONDS)


def _ensure_scheduler(celery_app) -> None:
    global _scheduler_thread
    with _scheduler_lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return

        bootstrap_schedule()

        thread = threading.Thread(
            target=_scheduler_loop,
            args=(celery_app,),
            name="latency_sleuth_scheduler",
            daemon=True,
        )
        thread.start()
        _scheduler_thread = thread
        logger.info("latency-sleuth scheduler thread started")


def register(celery_app, register_handler: Callable[[str, JobHandler], None]) -> None:  # noqa: D401
    """Register worker handlers for the Latency Sleuth toolkit."""

    register_handler("latency-sleuth.run_probe", _handle_run_probe)

    global _scheduler_registered
    if _scheduler_registered:
        return

    _ensure_scheduler(celery_app)
    _scheduler_registered = True


__all__ = ["register", "_handle_run_probe"]
