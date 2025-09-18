from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from app.core.redis import get_redis, redis_key
from .models import (
    ZabbixInstance,
    ZabbixInstanceCreate,
    ZabbixInstanceUpdate,
)


INSTANCES_KEY = redis_key("toolkits", "zabbix", "instances")


def _serialize(instance: ZabbixInstance) -> str:
    return json.dumps(instance.model_dump(mode="json"))


def _deserialize(raw: str) -> ZabbixInstance:
    data = json.loads(raw)
    return ZabbixInstance.model_validate(data)


def list_instances() -> List[ZabbixInstance]:
    redis = get_redis()
    records = redis.hvals(INSTANCES_KEY)
    instances = [_deserialize(raw) for raw in records]
    instances.sort(key=lambda inst: (inst.name.lower(), inst.created_at))
    return instances


def get_instance(instance_id: str) -> Optional[ZabbixInstance]:
    redis = get_redis()
    raw = redis.hget(INSTANCES_KEY, instance_id)
    if not raw:
        return None
    return _deserialize(raw)


def save_instance(instance: ZabbixInstance) -> None:
    redis = get_redis()
    redis.hset(INSTANCES_KEY, instance.id, _serialize(instance))


def create_instance(payload: ZabbixInstanceCreate) -> ZabbixInstance:
    now = datetime.now(timezone.utc)
    instance = ZabbixInstance(
        id=str(uuid4()),
        created_at=now,
        updated_at=now,
        **payload.model_dump(),
    )
    save_instance(instance)
    return instance


def update_instance(instance_id: str, payload: ZabbixInstanceUpdate) -> Optional[ZabbixInstance]:
    instance = get_instance(instance_id)
    if not instance:
        return None
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        return instance
    updated = instance.model_copy(update=data)
    updated.updated_at = datetime.now(timezone.utc)
    save_instance(updated)
    return updated


def delete_instance(instance_id: str) -> bool:
    redis = get_redis()
    return bool(redis.hdel(INSTANCES_KEY, instance_id))
