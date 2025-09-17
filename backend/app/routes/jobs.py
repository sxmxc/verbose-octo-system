from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal, Optional
from ..worker_client import enqueue_job, get_job_status

router = APIRouter()

class EnqueueJobRequest(BaseModel):
    type: Literal["bulk_add_hosts"]
    payload: dict = Field(default_factory=dict)

@router.post("/", summary="Enqueue a job")
def create_job(req: EnqueueJobRequest):
    job_id = enqueue_job(req.type, req.payload)
    return {"job_id": job_id}

@router.get("/{job_id}", summary="Get job status")
def job_status(job_id: str):
    return get_job_status(job_id)
