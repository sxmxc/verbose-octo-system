from __future__ import annotations

from dataclasses import dataclass

from redis import Redis

from ..core.redis import redis_key


@dataclass(frozen=True)
class LoginThrottleConfig:
    """Holds throttle configuration for local authentication."""

    max_attempts: int
    window_seconds: int
    lockout_seconds: int

    @property
    def enabled(self) -> bool:
        return all(value > 0 for value in (self.max_attempts, self.window_seconds, self.lockout_seconds))

    @classmethod
    def from_provider(cls, provider_config: object) -> "LoginThrottleConfig":
        """Build config from a local auth provider definition.

        Accepts duck-typed objects (Pydantic models or dict-backed instances) so tests can
        construct providers without importing the settings class directly.
        """

        max_attempts = getattr(provider_config, "max_attempts", 0)
        window_seconds = getattr(provider_config, "window_seconds", 0)
        lockout_seconds = getattr(provider_config, "lockout_seconds", 0)
        return cls(
            max_attempts=int(max_attempts),
            window_seconds=int(window_seconds),
            lockout_seconds=int(lockout_seconds),
        )


def _normalize_subject(subject: str) -> str:
    return subject.strip().lower()


def _attempt_key(subject: str) -> str:
    return redis_key("auth", "local", "attempts", subject)


def _lockout_key(subject: str) -> str:
    return redis_key("auth", "local", "lockout", subject)


def check_lockout(client: Redis, subject: str) -> int:
    """Return lockout TTL (seconds) if the subject is locked, otherwise 0."""

    normalized = _normalize_subject(subject)
    ttl = client.ttl(_lockout_key(normalized))
    if ttl and ttl > 0:
        return ttl
    return 0


def record_failure(client: Redis, subject: str, config: LoginThrottleConfig) -> tuple[bool, int]:
    """Record a failed login attempt.

    Returns a tuple of (locked, metric) where metric is the remaining lockout TTL if locked,
    otherwise the number of attempts remaining before lockout.
    """

    if not config.enabled:
        return False, config.max_attempts

    normalized = _normalize_subject(subject)
    attempts_key = _attempt_key(normalized)
    attempts = client.incr(attempts_key)
    client.expire(attempts_key, config.window_seconds)

    if attempts >= config.max_attempts:
        client.delete(attempts_key)
        lock_key = _lockout_key(normalized)
        client.set(lock_key, "1", ex=config.lockout_seconds)
        ttl = client.ttl(lock_key)
        return True, ttl if ttl and ttl > 0 else config.lockout_seconds

    remaining = max(config.max_attempts - attempts, 0)
    return False, remaining


def reset_attempts(client: Redis, subject: str) -> None:
    """Clear stored failed-attempt counters for the subject."""

    normalized = _normalize_subject(subject)
    client.delete(_attempt_key(normalized))


__all__ = [
    "LoginThrottleConfig",
    "check_lockout",
    "record_failure",
    "reset_attempts",
]
