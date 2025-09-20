from __future__ import annotations

import json
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel, Field

from ..db.session import get_session
from ..config import settings
from ..security.dependencies import require_superuser
from ..services.provider_configs import ProviderConfigService
from ..services.users import UserService
from ..secrets import VaultSecretRef, write_vault_secret

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


class VaultSecretCreateRequest(BaseModel):
    mount: Optional[str] = Field(default=None, description="Vault mount point (defaults to VAULT_KV_MOUNT)")
    path: str
    key: str
    engine: Literal["kv-v2", "kv-v1"] = "kv-v2"
    value: str


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
    current_user=Depends(require_superuser),
) -> Dict[str, Any]:
    payload = await request.json()
    if "type" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider type required")
    service = ProviderConfigService(session)
    record = await service.upsert_config(payload)
    await service.reload_registry()
    user_service = UserService(session)
    await user_service.audit(
        user=None,
        actor=current_user,
        event="security.provider.update",
        payload={
            "name": record.name,
            "type": record.type,
            "enabled": record.enabled,
        },
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        target_type="auth_provider",
        target_id=record.name,
    )
    await session.commit()
    return _serialize(record)


@router.post("/providers/vault-secret", status_code=status.HTTP_201_CREATED)
async def create_vault_secret(
    payload: VaultSecretCreateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_superuser),
) -> Dict[str, Any]:
    ref = VaultSecretRef(
        mount=payload.mount,
        path=payload.path,
        key=payload.key,
        engine=payload.engine,
    )
    try:
        write_vault_secret(settings, ref, payload.value)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user_service = UserService(session)
    await user_service.audit(
        user=None,
        actor=current_user,
        event="security.provider.vault_secret.upsert",
        payload={
            "mount": ref.mount or settings.vault_kv_mount,
            "path": ref.path,
            "key": ref.key,
            "engine": ref.engine,
        },
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        target_type="vault_secret",
        target_id=f"{ref.mount or settings.vault_kv_mount}:{ref.path}:{ref.key}",
    )
    await session.commit()
    return {
        "ref": {
            "mount": ref.mount,
            "path": ref.path,
            "key": ref.key,
            "engine": ref.engine,
        }
    }


@router.delete(
    "/providers/{name}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_provider_config(
    name: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_superuser),
) -> Response:
    service = ProviderConfigService(session)
    record = await service.delete_config(name)
    await service.reload_registry()
    user_service = UserService(session)
    await user_service.audit(
        user=None,
        actor=current_user,
        event="security.provider.delete",
        payload={
            "name": record.name,
            "type": record.type,
        },
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        target_type="auth_provider",
        target_id=name,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
