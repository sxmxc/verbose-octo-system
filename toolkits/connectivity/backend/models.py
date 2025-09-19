from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, validator


class ProbePort(BaseModel):
    port: int = Field(..., ge=1, le=65535)
    protocol: Literal["tcp", "udp"] = "tcp"

    @validator("protocol", pre=True)
    def normalize_protocol(cls, value: str) -> str:
        return value.lower()


class ProbeEndpoint(BaseModel):
    host: str = Field(..., description="Hostname or IP to probe")
    ports: List[ProbePort] = Field(default_factory=list)


class ConnectivityTargetBase(BaseModel):
    name: str = Field(..., max_length=120)
    description: Optional[str] = Field(default=None, max_length=400)
    endpoints: List[ProbeEndpoint] = Field(default_factory=list)


class ConnectivityTargetCreate(ConnectivityTargetBase):
    pass


class ConnectivityTargetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=400)
    endpoints: Optional[List[ProbeEndpoint]] = None


class ConnectivityTarget(ConnectivityTargetBase):
    id: str
    created_at: datetime
    updated_at: datetime


class ConnectivityTargetPublic(ConnectivityTargetBase):
    id: str
    created_at: datetime
    updated_at: datetime
    endpoint_count: int


class ProbeResult(BaseModel):
    host: str = Field(..., description="Hostname or IP probed")
    port: int
    protocol: Literal["tcp", "udp"]
    status: Literal["reachable", "unreachable"]
    latency_ms: float
    message: Optional[str] = None
    attempt: int = Field(default=1, ge=1, description="Sequential attempt number for this probe")


class ConnectivitySummary(BaseModel):
    ok: bool
    total_probes: int
    failures: int
    results: List[ProbeResult]
    repetitions: int = Field(default=1, ge=1)
