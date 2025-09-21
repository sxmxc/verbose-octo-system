from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from toolkit_runtime import jobs as job_store
from toolkit_runtime import enqueue_job

from .models import (
    LatencyHeatmap,
    ProbeExecutionSummary,
    ProbeTemplate,
    ProbeTemplateCreate,
    ProbeTemplateUpdate,
)
from .probes import execute_probe
from .storage import (
    build_heatmap,
    create_template,
    delete_template,
    get_template,
    list_history,
    list_templates,
    update_template,
)


router = APIRouter()


class ProbeRunRequest(BaseModel):
    sample_size: int = Field(default=3, ge=1, le=20)
    latency_overrides: Optional[List[float]] = None


@router.get("/probe-templates", response_model=List[ProbeTemplate])
def probe_templates_index() -> List[ProbeTemplate]:
    return sorted(list_templates(), key=lambda template: template.created_at)


@router.post(
    "/probe-templates",
    response_model=ProbeTemplate,
    status_code=status.HTTP_201_CREATED,
)
def probe_templates_create(payload: ProbeTemplateCreate) -> ProbeTemplate:
    return create_template(payload)


@router.get("/probe-templates/{template_id}", response_model=ProbeTemplate)
def probe_templates_show(template_id: str) -> ProbeTemplate:
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/probe-templates/{template_id}", response_model=ProbeTemplate)
def probe_templates_update(template_id: str, payload: ProbeTemplateUpdate) -> ProbeTemplate:
    template = update_template(template_id, payload)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.delete("/probe-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def probe_templates_delete(template_id: str) -> Response:
    deleted = delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/probe-templates/{template_id}/actions/preview",
    response_model=ProbeExecutionSummary,
)
def probe_templates_preview(template_id: str, payload: ProbeRunRequest | None = None) -> ProbeExecutionSummary:
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    params = payload or ProbeRunRequest()
    return execute_probe(
        template,
        sample_size=params.sample_size,
        overrides=params.latency_overrides,
    )


@router.post(
    "/probe-templates/{template_id}/actions/run",
    status_code=status.HTTP_202_ACCEPTED,
)
def probe_templates_run(template_id: str, payload: ProbeRunRequest | None = None) -> dict:
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    params = payload or ProbeRunRequest()
    job = enqueue_job(
        toolkit="latency-sleuth",
        operation="run_probe",
        payload={
            "template_id": template_id,
            "sample_size": params.sample_size,
            "latency_overrides": params.latency_overrides,
        },
    )
    return {"job": job}


@router.get("/probe-templates/{template_id}/heatmap", response_model=LatencyHeatmap)
def probe_templates_heatmap(template_id: str, columns: int = 6) -> LatencyHeatmap:
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return build_heatmap(template_id, columns=columns)


@router.get("/probe-templates/{template_id}/history", response_model=List[ProbeExecutionSummary])
def probe_templates_history(template_id: str, limit: int = 10) -> List[ProbeExecutionSummary]:
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    history = list_history(template_id, limit=limit)
    return [entry.summary for entry in history]


@router.get("/jobs")
def list_jobs(template_id: Optional[str] = None) -> List[dict]:
    jobs, _ = job_store.list_jobs(toolkits=["latency-sleuth"])
    if template_id:
        jobs = [job for job in jobs if job.get("payload", {}).get("template_id") == template_id]
    return jobs


@router.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job
