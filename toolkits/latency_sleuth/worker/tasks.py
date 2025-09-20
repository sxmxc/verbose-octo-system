from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Sequence

from app.services import jobs as job_store

from backend.probes import execute_probe
from backend.storage import get_template, record_probe_result

JobPayload = Dict[str, Any]
JobRecord = Dict[str, Any]
JobHandler = Callable[[JobRecord], JobRecord]


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


def register(celery_app, register_handler: Callable[[str, JobHandler], None]) -> None:  # noqa: D401
    """Register worker handlers for the Latency Sleuth toolkit."""

    register_handler("latency-sleuth.run_probe", _handle_run_probe)


__all__ = ["register", "_handle_run_probe"]
