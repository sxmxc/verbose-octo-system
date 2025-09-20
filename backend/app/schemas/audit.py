from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class AuditEventSchema(BaseModel):
    name: str
    category: str
    description: str
    severity: str


class AuditLogActor(BaseModel):
    id: str
    username: str
    display_name: Optional[str]
    email: Optional[str]


class AuditLogEntry(BaseModel):
    id: str
    event: str
    severity: str
    category: Optional[str]
    description: Optional[str]
    created_at: datetime
    source_ip: Optional[str]
    user_agent: Optional[str]
    target_type: Optional[str]
    target_id: Optional[str]
    actor: Optional[AuditLogActor]
    payload: Optional[Dict[str, Any]]


class AuditLogListResponse(BaseModel):
    items: List[AuditLogEntry]
    next_cursor: Optional[datetime]
    events: List[AuditEventSchema]
