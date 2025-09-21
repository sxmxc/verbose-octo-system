from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from toolkit_runtime import enqueue_job

from .models import (
    ConnectivitySummary,
    ConnectivityTargetCreate,
    ConnectivityTargetPublic,
    ConnectivityTargetUpdate,
    ProbeEndpoint,
)
from .probes import simulate_connectivity
from .storage import create_target, delete_target, get_target, list_targets, update_target


router = APIRouter()


class AdhocCheckRequest(BaseModel):
    endpoints: List[ProbeEndpoint]
    repetitions: int = 1


class PreviewRequest(BaseModel):
    repetitions: int = 1


class JobRequest(BaseModel):
    repetitions: Optional[int] = None


def _to_public(target) -> ConnectivityTargetPublic:
    endpoint_count = len(target.endpoints)
    return ConnectivityTargetPublic(
        id=target.id,
        name=target.name,
        description=target.description,
        endpoints=target.endpoints,
        created_at=target.created_at,
        updated_at=target.updated_at,
        endpoint_count=endpoint_count,
    )


@router.get("/targets", response_model=List[ConnectivityTargetPublic])
def targets_index():
    return [_to_public(target) for target in list_targets()]


@router.post("/targets", response_model=ConnectivityTargetPublic, status_code=status.HTTP_201_CREATED)
def targets_create(payload: ConnectivityTargetCreate):
    target = create_target(payload)
    return _to_public(target)


@router.get("/targets/{target_id}", response_model=ConnectivityTargetPublic)
def targets_show(target_id: str):
    target = get_target(target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return _to_public(target)


@router.put("/targets/{target_id}", response_model=ConnectivityTargetPublic)
def targets_update(target_id: str, payload: ConnectivityTargetUpdate):
    target = update_target(target_id, payload)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return _to_public(target)


@router.delete("/targets/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def targets_delete(target_id: str):
    deleted = delete_target(target_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")


@router.post("/targets/{target_id}/actions/check/preview", response_model=ConnectivitySummary)
def targets_preview(target_id: str, payload: PreviewRequest | None = None):
    target = get_target(target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    repetitions = payload.repetitions if payload else 1
    return simulate_connectivity(target.endpoints, repetitions=repetitions)


@router.post("/targets/{target_id}/actions/check/execute")
def targets_execute(target_id: str, payload: JobRequest | None = None):
    target = get_target(target_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    job = enqueue_job(
        toolkit="connectivity",
        operation="bulk_probe",
        payload={
            "target_id": target_id,
            "repetitions": payload.repetitions if payload and payload.repetitions else 1,
        },
    )
    return {"job": job}


@router.post("/actions/adhoc-check", response_model=ConnectivitySummary)
def adhoc_check(payload: AdhocCheckRequest):
    if not payload.endpoints:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one endpoint is required")
    return simulate_connectivity(payload.endpoints, repetitions=payload.repetitions)
