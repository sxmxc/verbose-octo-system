from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.system import SystemSetting


class SystemSettingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, key: str) -> SystemSetting | None:
        return await self.session.get(SystemSetting, key)

    async def get_json(self, key: str, default: Any = None) -> Any:
        record = await self.get(key)
        if not record or record.value is None:
            return default
        try:
            return json.loads(record.value)
        except json.JSONDecodeError:
            return default

    async def set_json(self, key: str, value: Any) -> SystemSetting:
        payload = json.dumps(value)
        record = await self.get(key)
        if record:
            record.value = payload
        else:
            record = SystemSetting(key=key, value=payload)
            self.session.add(record)
        await self.session.flush()
        return record

    async def delete(self, key: str) -> None:
        record = await self.get(key)
        if record:
            await self.session.delete(record)


__all__ = ["SystemSettingService"]
