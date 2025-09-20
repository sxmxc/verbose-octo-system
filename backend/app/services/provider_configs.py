from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.auth_provider import AuthProviderConfig
from ..security.registry import load_providers


class ProviderConfigService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_configs(self) -> List[AuthProviderConfig]:
        result = await self.session.execute(select(AuthProviderConfig))
        return list(result.scalars().all())

    async def get_config(self, name: str) -> AuthProviderConfig | None:
        stmt = select(AuthProviderConfig).where(AuthProviderConfig.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_config(self, payload: Dict[str, Any]) -> AuthProviderConfig:
        name = payload.get("name")
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider name required")
        record = await self.get_config(name)
        config_json = json.dumps(payload, ensure_ascii=False)
        if record:
            record.config = config_json
            record.type = payload.get("type", record.type)
            record.enabled = payload.get("enabled", record.enabled)
        else:
            record = AuthProviderConfig(
                name=name,
                type=payload.get("type", "local"),
                config=config_json,
                enabled=payload.get("enabled", True),
            )
            self.session.add(record)
        await self.session.flush()
        return record

    async def delete_config(self, name: str) -> AuthProviderConfig:
        record = await self.get_config(name)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
        await self.session.delete(record)
        return record

    async def reload_registry(self) -> None:
        await load_providers(self.session)
