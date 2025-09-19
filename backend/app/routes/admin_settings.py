from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..security.dependencies import require_superuser
from ..services.provider_configs import ProviderConfigService

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


def _serialize(record) -> Dict[str, Any]:
    try:
        config_payload = json.loads(record.config)
    except json.JSONDecodeError:  # pragma: no cover - defensive
        config_payload = {}
    config_payload.setdefault("name", record.name)
    config_payload.setdefault("type", record.type)
    config_payload.setdefault("enabled", record.enabled)
    return config_payload


@router.get("/providers")
async def list_provider_configs(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_superuser),
) -> Dict[str, Any]:
    service = ProviderConfigService(session)
    records = await service.list_configs()
    return {"providers": [_serialize(record) for record in records]}


@router.post("/providers", status_code=status.HTTP_201_CREATED)
async def upsert_provider_config(
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_superuser),
) -> Dict[str, Any]:
    payload = await request.json()
    if "type" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider type required")
    service = ProviderConfigService(session)
    record = await service.upsert_config(payload)
    await service.reload_registry()
    await session.commit()
    return _serialize(record)


@router.delete(
    "/providers/{name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_provider_config(
    name: str,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_superuser),
) -> Response:
    service = ProviderConfigService(session)
    await service.delete_config(name)
    await service.reload_registry()
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
