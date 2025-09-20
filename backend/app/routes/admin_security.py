from __future__ import annotations

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..schemas.audit import (
    AuditEventSchema,
    AuditLogActor,
    AuditLogEntry,
    AuditLogListResponse,
    AuditSettingsResponse,
    AuditSettingsUpdateRequest,
)
from ..security.audit_events import get_audit_event, list_audit_events
from ..security.dependencies import require_roles
from ..security.roles import ROLE_SYSTEM_ADMIN
from ..services.audit import AuditService, parse_payload

router = APIRouter(prefix="/admin/security", tags=["admin-security"])


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    *,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    before: datetime | None = Query(None),
    event: str | None = Query(None),
    severity: str | None = Query(None),
    user_id: str | None = Query(None),
    target_type: str | None = Query(None),
    target_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_SYSTEM_ADMIN])),
) -> AuditLogListResponse:
    service = AuditService(session)
    records, total = await service.list_logs(
        page=page,
        page_size=page_size,
        created_before=before,
        user_ids=[user_id] if user_id else None,
        events=[event] if event else None,
        severities=[severity] if severity else None,
        target_types=[target_type] if target_type else None,
        target_ids=[target_id] if target_id else None,
    )
    items: List[AuditLogEntry] = []
    for record in records:
        definition = get_audit_event(record.event)
        actor = None
        if record.user:
            actor = AuditLogActor(
                id=record.user.id,
                username=record.user.username,
                display_name=record.user.display_name,
                email=record.user.email,
            )
        items.append(
            AuditLogEntry(
                id=record.id,
                event=record.event,
                severity=record.severity,
                category=definition.category if definition else None,
                description=definition.description if definition else None,
                created_at=record.created_at,
                source_ip=record.source_ip,
                user_agent=record.user_agent,
                target_type=record.target_type,
                target_id=record.target_id,
                actor=actor,
                payload=parse_payload(record),
            )
        )
    retention_days = await service.get_retention_days()
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    events = [
        AuditEventSchema(
            name=definition.name,
            category=definition.category,
            description=definition.description,
            severity=definition.severity,
        )
        for definition in list_audit_events()
    ]
    return AuditLogListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        pages=total_pages,
        events=events,
        retention_days=retention_days,
    )


@router.get("/settings", response_model=AuditSettingsResponse)
async def get_audit_settings(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_SYSTEM_ADMIN])),
) -> AuditSettingsResponse:
    service = AuditService(session)
    retention_days = await service.get_retention_days()
    return AuditSettingsResponse(retention_days=retention_days)


@router.put("/settings", response_model=AuditSettingsResponse)
async def update_audit_settings(
    payload: AuditSettingsUpdateRequest,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_SYSTEM_ADMIN])),
) -> AuditSettingsResponse:
    service = AuditService(session)
    try:
        await service.set_retention_days(payload.retention_days)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await service.purge_expired(payload.retention_days)
    await session.commit()
    return AuditSettingsResponse(retention_days=payload.retention_days)
