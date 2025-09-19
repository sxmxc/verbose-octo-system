from __future__ import annotations

import time
from typing import Callable, Dict

from backend.storage import get_instance
from app.services import jobs as job_store


def _handle_bulk_add_hosts(job: Dict) -> Dict:
    payload = job.get("payload", {})
    instance_id = payload.get("instance_id")
    rows = payload.get("rows", [])
    if not instance_id:
        raise ValueError("Missing instance_id in payload")

    instance = get_instance(instance_id)
    if not instance:
        raise ValueError(f"Zabbix instance {instance_id} not found")

    job = job_store.append_log(job, f"Target instance: {instance.name}")
    job = job_store.append_log(job, f"Preparing to create {len(rows)} host(s)")

    total = max(len(rows), 1)
    for idx, row in enumerate(rows, start=1):
        current = job_store.get_job(job["id"])
        if current and current.get("status") == "cancelling":
            job = current
            processed = idx - 1
            job["progress"] = int(processed / total * 100)
            job["result"] = {
                "created": processed,
                "instance_id": instance.id,
                "instance_name": instance.name,
                "cancelled": True,
            }
            job = job_store.mark_cancelled(job, "Cancellation acknowledged during execution")
            return job

        host = row.get("host")
        time.sleep(0.1)
        job["progress"] = int(idx / total * 100)
        job_store.save_job(job)
        job = job_store.append_log(job, f"Simulated create for host '{host}' ({idx}/{total})")

    job["status"] = "succeeded"
    job["progress"] = 100
    job["result"] = {
        "created": len(rows),
        "instance_id": instance.id,
        "instance_name": instance.name,
    }
    return job


def register(celery_app, register_handler: Callable[[str, Callable[[Dict], Dict]], None]) -> None:  # noqa: D401 - signature matches toolkit loader expectations
    """Register Zabbix toolkit handlers with the worker."""
    register_handler("zabbix.bulk_add_hosts", _handle_bulk_add_hosts)
