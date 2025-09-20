from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import List, Sequence

from sqlalchemy import Select, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.user import AuditLog, User
from ..config import settings
from .system_settings import SystemSettingService


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
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(record)
        await self.session.flush()
        await self._enforce_retention()
        return record

    async def get_retention_days(self) -> int:
        settings_service = SystemSettingService(self.session)
        stored = await settings_service.get_json("audit.retention_days")
        if isinstance(stored, int) and stored > 0:
            return stored
        return settings.audit_log_retention_days

    async def set_retention_days(self, days: int) -> None:
        if days <= 0:
            raise ValueError("Retention days must be greater than zero")
        settings_service = SystemSettingService(self.session)
        await settings_service.set_json("audit.retention_days", int(days))
        await self.session.flush()

    async def purge_expired(self, retention_days: int | None = None) -> int:
        days = retention_days if retention_days is not None else await self.get_retention_days()
        if days <= 0:
            return 0
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = delete(AuditLog).where(AuditLog.created_at < cutoff)
        result = await self.session.execute(stmt)
        return result.rowcount or 0

    async def _enforce_retention(self) -> None:
        await self.purge_expired()

    def _apply_filters(
        self,
        stmt: Select[tuple[AuditLog]],
        *,
        created_before: datetime | None = None,
        user_ids: Sequence[str] | None = None,
        events: Sequence[str] | None = None,
        severities: Sequence[str] | None = None,
        target_types: Sequence[str] | None = None,
        target_ids: Sequence[str] | None = None,
    ) -> Select[tuple[AuditLog]]:
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
        return stmt

    async def list_logs(
        self,
        *,
        page: int = 1,
        page_size: int = 100,
        created_before: datetime | None = None,
        user_ids: Sequence[str] | None = None,
        events: Sequence[str] | None = None,
        severities: Sequence[str] | None = None,
        target_types: Sequence[str] | None = None,
        target_ids: Sequence[str] | None = None,
    ) -> tuple[List[AuditLog], int]:
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 1
        count_stmt = self._apply_filters(
            select(func.count()).select_from(AuditLog),
            created_before=created_before,
            user_ids=user_ids,
            events=events,
            severities=severities,
            target_types=target_types,
            target_ids=target_ids,
        )
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar_one()

        stmt = self._apply_filters(
            select(AuditLog).options(selectinload(AuditLog.user)),
            created_before=created_before,
            user_ids=user_ids,
            events=events,
            severities=severities,
            target_types=target_types,
            target_ids=target_ids,
        ).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(stmt)
        records = list(result.scalars().all())
        return records, total


def parse_payload(record: AuditLog) -> dict | None:
    if not record.payload:
        return None
    try:
        parsed = json.loads(record.payload)
    except json.JSONDecodeError:
        return {"raw": record.payload}
    return parsed if isinstance(parsed, dict) else {"value": parsed}
