from functools import lru_cache

from redis import Redis

from ..config import settings


def redis_key(*parts: str) -> str:
    prefix = settings.redis_prefix.strip(":")
    suffix = ":".join(part.strip(":") for part in parts if part)
    return f"{prefix}:{suffix}" if suffix else prefix


@lru_cache(maxsize=1)
def _get_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def get_redis() -> Redis:
    """Return a shared Redis client for the app."""

    return _get_client()

