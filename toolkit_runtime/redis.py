"""Lightweight Redis helpers available to toolkits at runtime."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from redis import Redis

_DEFAULT_REDIS_URL = "redis://redis:6379/0"
_DEFAULT_REDIS_PREFIX = "sretoolbox"

try:  # pragma: no cover - optional dependency during runtime
    from backend.app.config import settings as _backend_settings
except Exception:  # noqa: BLE001 - falling back to environment defaults
    _backend_settings = None


def _settings_value(name: str) -> Optional[str]:
    if _backend_settings is None:
        return None

    value = getattr(_backend_settings, name, None)
    if isinstance(value, str) and value:
        return value

    return None


def redis_url() -> str:
    """Return the Redis connection URL visible to toolkits."""

    return (
        os.getenv("REDIS_URL")
        or _settings_value("redis_url")
        or _DEFAULT_REDIS_URL
    )


def redis_prefix() -> str:
    """Return the prefix applied to toolkit Redis keys."""

    value = (
        os.getenv("REDIS_PREFIX")
        or _settings_value("redis_prefix")
        or _DEFAULT_REDIS_PREFIX
    )
    stripped = value.strip(":")
    return stripped or _DEFAULT_REDIS_PREFIX


def redis_key(*parts: str) -> str:
    """Join multiple Redis key segments under the toolkit prefix."""

    prefix = redis_prefix()
    suffix = ":".join(part.strip(":") for part in parts if part)
    return f"{prefix}:{suffix}" if suffix else prefix


@lru_cache(maxsize=1)
def _get_client() -> Redis:
    return Redis.from_url(redis_url(), decode_responses=True)


def get_redis() -> Redis:
    """Return a cached Redis client using the shared configuration."""

    return _get_client()


def reset_redis_client() -> None:
    """Clear the cached Redis client (primarily for tests)."""

    _get_client.cache_clear()


__all__ = [
    "get_redis",
    "redis_key",
    "redis_prefix",
    "redis_url",
    "reset_redis_client",
]
