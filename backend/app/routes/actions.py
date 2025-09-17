from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any
from ..zbx.client import ZbxClient
from ..zbx.deps import get_zbx_client
from ..worker_client import enqueue_job

router = APIRouter()

class HostRow(BaseModel):
    host: str
    ip: str
    groups: List[str] = Field(default_factory=list)
    templates: List[str] = Field(default_factory=list)
    macros: Dict[str, str] = Field(default_factory=dict)

class BulkAddRequest(BaseModel):
    rows: List[HostRow]
    dry_run: bool = True

@router.post("/bulk-add-hosts/dry-run", summary="Dry-run bulk add hosts")
async def bulk_add_hosts_dry_run(req: BulkAddRequest, zbx: ZbxClient = Depends(get_zbx_client)):
    # TODO: Resolve names to IDs, check duplicates, etc.
    summary = {
        "create_count": len(req.rows),
        "warnings": [],
        "sample": [r.model_dump() for r in req.rows[:3]],
    }
    return {"ok": True, "summary": summary}

@router.post("/bulk-add-hosts/execute", summary="Execute bulk add hosts (queues job)")
async def bulk_add_hosts_execute(req: BulkAddRequest):
    job_id = enqueue_job("bulk_add_hosts", {"rows": [r.model_dump() for r in req.rows]})
    return {"queued": True, "job_id": job_id}
