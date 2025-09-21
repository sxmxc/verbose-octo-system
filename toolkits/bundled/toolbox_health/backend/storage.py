from __future__ import annotations

import json
from typing import Iterable, List, Optional

from toolkit_runtime.redis import get_redis, redis_key

from .models import ComponentHealth, HealthSummary


_SUMMARY_KEY = redis_key("toolkits", "toolbox_health", "summary")
_COMPONENTS_KEY = redis_key("toolkits", "toolbox_health", "components")


def _serialize_summary(summary: HealthSummary) -> str:
    return summary.model_dump_json()


def _deserialize_summary(raw: str) -> HealthSummary:
    data = json.loads(raw)
    return HealthSummary.model_validate(data)


def _serialize_components(components: Iterable[ComponentHealth]) -> str:
    payload = [component.model_dump(mode="json") for component in components]
    return json.dumps(payload)


def _deserialize_components(raw: str) -> List[ComponentHealth]:
    payload = json.loads(raw)
    return [ComponentHealth.model_validate(item) for item in payload]


def save_summary(summary: HealthSummary) -> None:
    redis = get_redis()
    redis.set(_SUMMARY_KEY, _serialize_summary(summary))
    redis.set(_COMPONENTS_KEY, _serialize_components(summary.components))


def load_summary() -> Optional[HealthSummary]:
    redis = get_redis()
    raw = redis.get(_SUMMARY_KEY)
    if not raw:
        return None
    try:
        return _deserialize_summary(raw)
    except Exception:
        return None


def load_components() -> List[ComponentHealth]:
    redis = get_redis()
    raw = redis.get(_COMPONENTS_KEY)
    if not raw:
        return []
    try:
        return _deserialize_components(raw)
    except Exception:
        return []


__all__ = ["save_summary", "load_summary", "load_components"]
