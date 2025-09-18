from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.worker_client import enqueue_job
from .client import ZbxClient
from .models import (
    BulkAddRequest,
    ZabbixInstanceCreate,
    ZabbixInstancePublic,
    ZabbixInstanceUpdate,
    to_public,
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
