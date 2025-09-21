from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional

from ..worker_client import cancel_job, enqueue_job, get_job_status, list_job_status
from ..security.dependencies import require_roles
from ..security.roles import ROLE_TOOLKIT_USER


router = APIRouter()


class EnqueueJobRequest(BaseModel):
    toolkit: str = Field(..., description="Toolkit that owns the job")
    operation: str = Field(..., description="Toolkit-specific operation identifier")
    payload: dict = Field(default_factory=dict)


@router.post("/", summary="Enqueue a job", dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))])
def create_job(req: EnqueueJobRequest):
    job = enqueue_job(req.toolkit, req.operation, req.payload)
    return {"job": job}


@router.get(
    "/",
    summary="List jobs",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def list_jobs(
    toolkit: Optional[List[str]] = Query(default=None),
    module: Optional[List[str]] = Query(default=None),
    status: Optional[List[str]] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    offset = (page - 1) * page_size
    jobs, total = list_job_status(
        limit=page_size,
        offset=offset,
        toolkits=toolkit,
        modules=module,
        statuses=status,
    )
    return {
        "jobs": jobs,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/{job_id}",
    summary="Get job status",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def job_status(job_id: str):
    return get_job_status(job_id)


@router.post(
    "/{job_id}/cancel",
    summary="Request job cancellation",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def job_cancel(job_id: str):
    job = cancel_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"job": job}
