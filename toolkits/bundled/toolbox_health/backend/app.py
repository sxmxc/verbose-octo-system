from __future__ import annotations

from fastapi import APIRouter, Query

from .health import get_or_refresh_summary
from .models import ComponentHealth, HealthSummary


router = APIRouter(prefix="/health")


@router.get(
    "/components",
    response_model=list[ComponentHealth],
    summary="Health for each toolbox component",
)
async def list_component_health(force_refresh: bool = Query(False, alias="force_refresh")) -> list[ComponentHealth]:
    """Return the most recent health snapshot for the toolbox core services."""

    summary = await get_or_refresh_summary(force_refresh=force_refresh)
    return summary.components


@router.get("/summary", response_model=HealthSummary, summary="Overall toolbox health summary")
async def health_summary(force_refresh: bool = Query(False, alias="force_refresh")) -> HealthSummary:
    """Aggregate component health into a single status payload."""

    return await get_or_refresh_summary(force_refresh=force_refresh)

