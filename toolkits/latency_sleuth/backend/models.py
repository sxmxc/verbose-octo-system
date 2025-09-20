from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


NotificationChannel = Literal["slack", "pagerduty", "email", "webhook"]
NotificationThreshold = Literal["always", "breach", "recovery"]


class NotificationRule(BaseModel):
    """Describe how probe breaches should alert external systems."""

    channel: NotificationChannel
    target: str = Field(..., min_length=1)
    threshold: NotificationThreshold = "breach"


class ProbeTemplateBase(BaseModel):
    """Common payload shared across template operations."""

    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    url: HttpUrl
    method: Literal["GET", "HEAD", "POST"] = "GET"
    sla_ms: int = Field(..., gt=0, le=60000)
    interval_seconds: int = Field(default=300, ge=30, le=3600)
    notification_rules: List[NotificationRule] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def _dedupe_tags(cls, value: List[str]) -> List[str]:
        seen = []
        for tag in value:
            if tag and tag not in seen:
                seen.append(tag)
        return seen


class ProbeTemplateCreate(ProbeTemplateBase):
    pass


class ProbeTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    url: Optional[HttpUrl] = None
    method: Optional[Literal["GET", "HEAD", "POST"]] = None
    sla_ms: Optional[int] = Field(default=None, gt=0, le=60000)
    interval_seconds: Optional[int] = Field(default=None, ge=30, le=3600)
    notification_rules: Optional[List[NotificationRule]] = None
    tags: Optional[List[str]] = None

    @field_validator("tags")
    @classmethod
    def _dedupe_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        seen: List[str] = []
        for tag in value:
            if tag and tag not in seen:
                seen.append(tag)
        return seen


class ProbeTemplate(ProbeTemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime
    next_run_at: Optional[datetime] = None


class ProbeExecutionSample(BaseModel):
    attempt: int
    timestamp: datetime
    latency_ms: float
    breach: bool
    message: Optional[str] = None


class ProbeExecutionSummary(BaseModel):
    template_id: str
    template_name: str
    sla_ms: int
    samples: List[ProbeExecutionSample]
    average_latency_ms: float
    breach_count: int
    met_sla: bool
    notified_channels: List[NotificationChannel] = Field(default_factory=list)

    @classmethod
    def from_samples(
        cls,
        template_id: str,
        template_name: str,
        sla_ms: int,
        samples: List[ProbeExecutionSample],
        notified_channels: Optional[List[NotificationChannel]] = None,
    ) -> "ProbeExecutionSummary":
        breach_count = sum(1 for sample in samples if sample.breach)
        average_latency = mean(sample.latency_ms for sample in samples) if samples else 0.0
        return cls(
            template_id=template_id,
            template_name=template_name,
            sla_ms=sla_ms,
            samples=samples,
            average_latency_ms=round(average_latency, 2),
            breach_count=breach_count,
            met_sla=breach_count == 0,
            notified_channels=notified_channels or [],
        )


class ProbeHistoryEntry(BaseModel):
    template_id: str
    recorded_at: datetime
    summary: ProbeExecutionSummary


class HeatmapCell(BaseModel):
    timestamp: datetime
    latency_ms: float
    breach: bool


class LatencyHeatmap(BaseModel):
    template_id: str
    columns: int
    rows: List[List[HeatmapCell]]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
