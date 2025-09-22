from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..security.dependencies import require_superuser
from ..services.system_settings import SystemSettingService
from .toolkits import CATALOG_URL_SETTING_KEY, _resolve_catalog_url


class CatalogSettingsResponse(BaseModel):
    effective_url: AnyHttpUrl | None
    configured_url: AnyHttpUrl | None = None


class CatalogSettingsRequest(BaseModel):
    url: AnyHttpUrl | None = None


router = APIRouter(prefix="/admin/toolbox", tags=["admin-toolbox"])


@router.get("/catalog", response_model=CatalogSettingsResponse)
async def get_catalog_settings(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_superuser),
) -> CatalogSettingsResponse:
    effective, configured = await _resolve_catalog_url(session)
    return CatalogSettingsResponse(effective_url=effective, configured_url=configured)


@router.post("/catalog", response_model=CatalogSettingsResponse)
async def update_catalog_settings(
    payload: CatalogSettingsRequest,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_superuser),
) -> CatalogSettingsResponse:
    settings_service = SystemSettingService(session)
    if payload.url:
        await settings_service.set_json(CATALOG_URL_SETTING_KEY, str(payload.url))
    else:
        await settings_service.delete(CATALOG_URL_SETTING_KEY)
    await session.commit()
    effective, configured = await _resolve_catalog_url(session)
    return CatalogSettingsResponse(effective_url=effective, configured_url=configured)
