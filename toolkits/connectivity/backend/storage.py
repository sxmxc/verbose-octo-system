from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from app.core.redis import get_redis, redis_key

from .models import ConnectivityTarget, ConnectivityTargetCreate, ConnectivityTargetUpdate


TARGETS_KEY = redis_key("toolkits", "connectivity", "targets")


def _serialize(target: ConnectivityTarget) -> str:
    return json.dumps(target.model_dump(mode="json"))


def _deserialize(raw: str) -> ConnectivityTarget:
    data = json.loads(raw)
    return ConnectivityTarget.model_validate(data)


def list_targets() -> List[ConnectivityTarget]:
    redis = get_redis()
    records = redis.hvals(TARGETS_KEY)
    targets = [_deserialize(raw) for raw in records]
    targets.sort(key=lambda target: (target.name.lower(), target.created_at))
    return targets


def get_target(target_id: str) -> Optional[ConnectivityTarget]:
    redis = get_redis()
    raw = redis.hget(TARGETS_KEY, target_id)
    if not raw:
        return None
    return _deserialize(raw)


def save_target(target: ConnectivityTarget) -> None:
    redis = get_redis()
    redis.hset(TARGETS_KEY, target.id, _serialize(target))


def delete_target(target_id: str) -> bool:
    redis = get_redis()
    return bool(redis.hdel(TARGETS_KEY, target_id))


def create_target(payload: ConnectivityTargetCreate) -> ConnectivityTarget:
    now = datetime.now(timezone.utc)
    target = ConnectivityTarget(
        id=str(uuid4()),
        created_at=now,
        updated_at=now,
        **payload.model_dump(),
    )
    save_target(target)
    return target


def update_target(target_id: str, payload: ConnectivityTargetUpdate) -> Optional[ConnectivityTarget]:
    existing = get_target(target_id)
    if not existing:
        return None

    data = payload.model_dump(exclude_unset=True)
    updated = existing.model_copy(update=data)
    updated.updated_at = datetime.now(timezone.utc)
    save_target(updated)
    return updated
