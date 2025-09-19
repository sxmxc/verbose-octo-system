from __future__ import annotations

import time
from typing import Callable, Dict

from backend.storage import get_instance
from app.services import jobs as job_store
from backend.catalog import (
    build_bulk_export_preview,
    build_db_script_preview,
    get_db_script,
    validate_db_script_inputs,
)
from backend.models import BulkExportRequest, DbScriptExecuteRequest


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


def _handle_bulk_export(job: Dict) -> Dict:
    payload = job.get("payload", {})
    instance_id = payload.get("instance_id")
    if not instance_id:
        raise ValueError("Missing instance_id in payload")

    instance = get_instance(instance_id)
    if not instance:
        raise ValueError(f"Zabbix instance {instance_id} not found")

    request = BulkExportRequest.model_validate({
        'target': payload.get('target', 'hosts'),
        'format': payload.get('format', 'json'),
        'filters': payload.get('filters', {}),
    })

    preview = build_bulk_export_preview(request)
    job = job_store.append_log(job, f"Preparing export for target '{request.target}' on {instance.name}")

    steps = 5
    for step in range(1, steps + 1):
        current = job_store.get_job(job["id"])
        if current and current.get("status") == "cancelling":
            job = job_store.mark_cancelled(current, "Cancellation acknowledged during export setup")
            return job
        time.sleep(0.15)
        job["progress"] = int(step / steps * 100)
        job_store.save_job(job)
        job = job_store.append_log(job, f"Export progress {step}/{steps}")

    job["status"] = "succeeded"
    job["progress"] = 100
    job["result"] = {
        "target": request.target,
        "format": request.format,
        "instance_id": instance.id,
        "instance_name": instance.name,
        "filters": request.filters,
        "estimated_records": preview.estimated_records,
        "sample_fields": preview.sample_fields,
    }
    return job


def _handle_db_script(job: Dict) -> Dict:
    payload = job.get("payload", {})
    instance_id = payload.get("instance_id")
    script_key = payload.get("script_key")
    inputs = payload.get("inputs", {})

    if not instance_id or not script_key:
        raise ValueError("Missing instance_id or script_key in payload")

    instance = get_instance(instance_id)
    if not instance:
        raise ValueError(f"Zabbix instance {instance_id} not found")

    script = get_db_script(script_key)
    if not script:
        raise ValueError(f"Script {script_key} not registered")

    request = DbScriptExecuteRequest.model_validate({"inputs": inputs, "dry_run": False})
    validate_db_script_inputs(script, request.inputs)

    job = job_store.append_log(job, f"Executing script '{script.name}' on {instance.name}")
    preview = build_db_script_preview(script, request.inputs)

    steps = max(len(preview.statements), 1)
    for idx, statement in enumerate(preview.statements, start=1):
        current = job_store.get_job(job["id"])
        if current and current.get("status") == "cancelling":
            job = job_store.mark_cancelled(current, "Cancellation acknowledged during script execution")
            return job
        time.sleep(0.2)
        job["progress"] = int(idx / steps * 100)
        job_store.save_job(job)
        job = job_store.append_log(job, f"Executing: {statement}")

    job["status"] = "succeeded"
    job["progress"] = 100
    job["result"] = {
        "script_key": script.key,
        "instance_id": instance.id,
        "instance_name": instance.name,
        "statements": preview.statements,
        "inputs": request.inputs,
    }
    return job


def register(celery_app, register_handler: Callable[[str, Callable[[Dict], Dict]], None]) -> None:  # noqa: D401 - signature matches toolkit loader expectations
    """Register Zabbix toolkit handlers with the worker."""
    register_handler("zabbix.bulk_add_hosts", _handle_bulk_add_hosts)
    register_handler("zabbix.bulk_export", _handle_bulk_export)
    register_handler("zabbix.db_script", _handle_db_script)
