from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from toolkit_runtime import enqueue_job
from .client import ZbxClient
from .models import (
    BulkAddRequest,
    BulkExportCatalogEntry,
    BulkExportPreviewResponse,
    BulkExportRequest,
    DbScript,
    DbScriptExecuteRequest,
    ZabbixInstanceCreate,
    ZabbixInstancePublic,
    ZabbixInstanceUpdate,
    to_public,
)
from .catalog import (
    build_bulk_export_preview,
    build_db_script_preview,
    get_bulk_export_catalog,
    get_db_script,
    get_db_scripts,
    validate_db_script_inputs,
)
from .storage import create_instance, delete_instance, get_instance, list_instances, update_instance


router = APIRouter()


class InstanceTestRequest(BaseModel):
    token: Optional[str] = None


@router.get("/instances", response_model=List[ZabbixInstancePublic])
def instances_index():
    return [to_public(instance) for instance in list_instances()]


@router.post("/instances", response_model=ZabbixInstancePublic, status_code=status.HTTP_201_CREATED)
def instances_create(payload: ZabbixInstanceCreate):
    instance = create_instance(payload)
    return to_public(instance)


@router.get("/instances/{instance_id}", response_model=ZabbixInstancePublic)
def instances_show(instance_id: str):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return to_public(instance)


@router.put("/instances/{instance_id}", response_model=ZabbixInstancePublic)
def instances_update(instance_id: str, payload: ZabbixInstanceUpdate):
    instance = update_instance(instance_id, payload)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return to_public(instance)


@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
def instances_delete(instance_id: str):
    deleted = delete_instance(instance_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")


@router.post("/instances/{instance_id}/test")
async def instances_test(instance_id: str, payload: InstanceTestRequest | None = None):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    token = payload.token if payload and payload.token else instance.token
    if not token:
        return {"ok": False, "error": "Instance does not have a token configured"}

    client = ZbxClient(str(instance.base_url), token, verify_tls=instance.verify_tls)
    try:
        version = await client.call("apiinfo.version", {})
        return {"ok": True, "version": version}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.post("/instances/{instance_id}/actions/bulk-add-hosts/dry-run")
async def bulk_add_hosts_dry_run(instance_id: str, req: BulkAddRequest):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    summary = {
        "create_count": len(req.rows),
        "warnings": [],
        "sample": [row.model_dump() for row in req.rows[:3]],
        "instance": to_public(instance).model_dump(mode="json"),
    }
    return {"ok": True, "summary": summary}


@router.post("/instances/{instance_id}/actions/bulk-add-hosts/execute")
def bulk_add_hosts_execute(instance_id: str, req: BulkAddRequest):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    job = enqueue_job(
        toolkit="zabbix",
        operation="bulk_add_hosts",
        payload={
            "instance_id": instance_id,
            "rows": [row.model_dump() for row in req.rows],
        },
    )
    return {"job": job}


@router.get("/actions/bulk-export/catalog", response_model=List[BulkExportCatalogEntry])
def bulk_export_catalog():
    return get_bulk_export_catalog()


@router.post("/instances/{instance_id}/actions/bulk-export/preview", response_model=BulkExportPreviewResponse)
def bulk_export_preview(instance_id: str, req: BulkExportRequest):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    summary = build_bulk_export_preview(req)
    return BulkExportPreviewResponse(summary=summary)


@router.post("/instances/{instance_id}/actions/bulk-export/execute")
def bulk_export_execute(instance_id: str, req: BulkExportRequest):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    job = enqueue_job(
        toolkit="zabbix",
        operation="bulk_export",
        payload={
            "instance_id": instance_id,
            "target": req.target,
            "format": req.format,
            "filters": req.filters,
        },
    )
    return {"job": job}


@router.get("/db-scripts", response_model=List[DbScript])
def db_scripts_index():
    return get_db_scripts()


@router.post("/instances/{instance_id}/actions/db-scripts/{script_key}/execute")
def db_scripts_execute(instance_id: str, script_key: str, req: DbScriptExecuteRequest):
    instance = get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    script = get_db_script(script_key)
    if not script:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Script not found")

    try:
        validate_db_script_inputs(script, req.inputs)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    if req.dry_run:
        preview = build_db_script_preview(script, req.inputs)
        return {"ok": True, "preview": preview, "message": "Dry run only. No database changes have been applied."}

    job = enqueue_job(
        toolkit="zabbix",
        operation="db_script",
        payload={
            "instance_id": instance_id,
            "script_key": script.key,
            "inputs": req.inputs,
        },
    )
    return {"ok": True, "job": job, "message": f"Queued database script '{script.name}'."}
