from __future__ import annotations

from fastapi import APIRouter

from .health import build_health_summary, gather_component_health
from .models import ComponentHealth, HealthSummary


router = APIRouter(prefix="/health")


@router.get("/components", response_model=list[ComponentHealth], summary="Health for each toolbox component")
async def list_component_health() -> list[ComponentHealth]:
    """Return the most recent health snapshot for the toolbox core services."""

    return await gather_component_health()


@router.get("/summary", response_model=HealthSummary, summary="Overall toolbox health summary")
async def health_summary() -> HealthSummary:
    """Aggregate component health into a single status payload."""

    return await build_health_summary()

