from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Literal

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    """Possible health states for toolbox components."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


ComponentName = Literal["frontend", "backend", "worker"]


class ComponentHealth(BaseModel):
    """Health payload for a single toolbox component."""

    component: ComponentName
    status: HealthStatus
    message: str
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    latency_ms: float | None = Field(default=None, description="Round-trip latency in milliseconds.")
    details: Dict[str, Any] | None = Field(default=None, description="Extra diagnostic details.")


class HealthSummary(BaseModel):
    """Aggregated health information covering all toolbox components."""

    overall_status: HealthStatus
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    components: list[ComponentHealth]
    notes: str | None = None

