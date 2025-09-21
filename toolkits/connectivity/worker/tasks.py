from __future__ import annotations

import time
from typing import Callable, Dict

from toolkit_runtime import jobs as job_store

from backend.probes import simulate_connectivity
from backend.storage import get_target


def _handle_bulk_probe(job: Dict) -> Dict:
    payload = job.get("payload", {})
    target_id = payload.get("target_id")
    if not target_id:
        raise ValueError("Missing target_id in job payload")

    target = get_target(target_id)
    if not target:
        raise ValueError(f"Connectivity target {target_id} not found")

    job = job_store.append_log(job, f"Starting connectivity check for group '{target.name}'")
    total_endpoints = len(target.endpoints)
    if total_endpoints == 0:
        job = job_store.append_log(job, "No endpoints configured; nothing to probe")
        job["status"] = "succeeded"
        job["progress"] = 100
        job["result"] = {
            "target_id": target.id,
            "target_name": target.name,
            "summary": {
                "ok": True,
                "total_probes": 0,
                "failures": 0,
                "results": [],
                "repetitions": 1,
            },
        }
        return job

    repetitions = int(payload.get("repetitions", 1) or 1)
    summary = simulate_connectivity(target.endpoints, repetitions=repetitions)

    for idx, result in enumerate(summary.results, start=1):
        current = job_store.get_job(job["id"])
        if current and current.get("status") == "cancelling":
            job = job_store.mark_cancelled(current, "Cancellation requested; aborting probes")
            return job
        time.sleep(0.05)
        job["progress"] = int(idx / max(len(summary.results), 1) * 100)
        status_icon = "✅" if result.status == "reachable" else "❌"
        message = result.message or f"{result.latency_ms} ms"
        job = job_store.append_log(
            job,
            f"{status_icon} attempt {result.attempt}: {result.host}:{result.port}/{result.protocol} — {message}",
        )
        job_store.save_job(job)

    job["status"] = "succeeded"
    job["progress"] = 100
    job["result"] = {
        "target_id": target.id,
        "target_name": target.name,
        "summary": summary.model_dump(),
        "repetitions": repetitions,
    }
    return job


def register(celery_app, register_handler: Callable[[str, Callable[[Dict], Dict]], None]) -> None:  # noqa: D401
    """Register worker handlers for the connectivity toolkit."""
    register_handler("connectivity.bulk_probe", _handle_bulk_probe)
