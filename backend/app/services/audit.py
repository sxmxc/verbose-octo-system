from __future__ import annotations

import json
from datetime import datetime
from typing import List, Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.user import AuditLog, User


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        actor: User | None,
        event: str,
        severity: str = "info",
        payload: dict | None = None,
        source_ip: str | None = None,
        user_agent: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
    ) -> AuditLog:
        record = AuditLog(
            user_id=actor.id if actor else None,
            event=event,
            severity=severity,
            payload=json.dumps(payload or {}, ensure_ascii=False) if payload else None,
            source_ip=source_ip,
            user_agent=user_agent,
            target_type=target_type,
            target_id=target_id,
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def list_logs(
        self,
        *,
        limit: int = 100,
        created_before: datetime | None = None,
        user_ids: Sequence[str] | None = None,
        events: Sequence[str] | None = None,
        severities: Sequence[str] | None = None,
        target_types: Sequence[str] | None = None,
        target_ids: Sequence[str] | None = None,
    ) -> List[AuditLog]:
        stmt: Select[tuple[AuditLog]] = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit)
        )
        if created_before:
            stmt = stmt.where(AuditLog.created_at < created_before)
        if user_ids:
            stmt = stmt.where(AuditLog.user_id.in_(user_ids))
        if events:
            stmt = stmt.where(AuditLog.event.in_(events))
        if severities:
            stmt = stmt.where(AuditLog.severity.in_(severities))
        if target_types:
            stmt = stmt.where(AuditLog.target_type.in_(target_types))
        if target_ids:
            stmt = stmt.where(AuditLog.target_id.in_(target_ids))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


def parse_payload(record: AuditLog) -> dict | None:
    if not record.payload:
        return None
    try:
        parsed = json.loads(record.payload)
    except json.JSONDecodeError:
        return {"raw": record.payload}
    return parsed if isinstance(parsed, dict) else {"value": parsed}
