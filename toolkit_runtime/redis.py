"""Lightweight Redis helpers available to toolkits at runtime."""

from __future__ import annotations

import os
from functools import lru_cache

from redis import Redis

_DEFAULT_REDIS_URL = "redis://redis:6379/0"
_DEFAULT_REDIS_PREFIX = "sretoolbox"


def redis_url() -> str:
    """Return the Redis connection URL visible to toolkits."""

    return os.getenv("REDIS_URL", _DEFAULT_REDIS_URL)


def redis_prefix() -> str:
    """Return the prefix applied to toolkit Redis keys."""

    value = os.getenv("REDIS_PREFIX", _DEFAULT_REDIS_PREFIX)
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
