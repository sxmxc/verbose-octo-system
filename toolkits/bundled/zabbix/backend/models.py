from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import AnyHttpUrl, BaseModel, Field


class ZabbixInstanceBase(BaseModel):
    name: str = Field(..., description="Friendly label for the Zabbix environment")
    base_url: AnyHttpUrl = Field(..., description="Base URL of the Zabbix server")
    token: str = Field(..., description="Permanent Zabbix API token")
    verify_tls: bool = Field(default=True, description="Verify TLS certificates when calling the API")
    description: Optional[str] = Field(default=None, description="Optional notes for operators")


class ZabbixInstanceCreate(ZabbixInstanceBase):
    pass


class ZabbixInstanceUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[AnyHttpUrl] = None
    token: Optional[str] = None
    verify_tls: Optional[bool] = None
    description: Optional[str] = None


class ZabbixInstance(ZabbixInstanceBase):
    id: str
    created_at: datetime
    updated_at: datetime


class ZabbixInstancePublic(BaseModel):
    id: str
    name: str
    base_url: AnyHttpUrl
    verify_tls: bool
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    has_token: bool = Field(default=True, description="True when a token is stored for the instance")


class HostRow(BaseModel):
    host: str
    ip: str
    groups: List[str] = Field(default_factory=list)
    templates: List[str] = Field(default_factory=list)
    macros: Dict[str, str] = Field(default_factory=dict)


class BulkAddRequest(BaseModel):
    rows: List[HostRow]
    dry_run: bool = True


def to_public(instance: ZabbixInstance) -> ZabbixInstancePublic:
    return ZabbixInstancePublic(
        id=instance.id,
        name=instance.name,
        base_url=instance.base_url,
        verify_tls=instance.verify_tls,
        description=instance.description,
        created_at=instance.created_at,
        updated_at=instance.updated_at,
        has_token=bool(instance.token),
    )
