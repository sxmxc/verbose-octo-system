"""Runtime validation for Postgres environment variables used by the stack helper."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Iterable, Mapping
from urllib.parse import unquote, urlsplit

PLACEHOLDER_TOKENS: tuple[str, ...] = (
    "CHANGE_ME",
    "__REPLACE",
    "<REPLACE",
)
MIN_PASSWORD_LENGTH = 12
REQUIRED_VARS: tuple[str, ...] = (
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "DATABASE_URL",
)
ALLOWED_DATABASE_SCHEMES = {"postgresql", "postgresql+asyncpg"}


@dataclass(slots=True)
class PostgresEnvError(RuntimeError):
    errors: tuple[str, ...]

    def __str__(self) -> str:  # pragma: no cover - inherited behaviour exercised via tests
        return "\n".join(self.errors)


def _looks_like_placeholder(value: str | None) -> bool:
    if not value:
        return False
    lowered = value.lower()
    if lowered in {"postgres", "password", "changeme", "change-me", "postgres_password"}:
        return True
    for token in PLACEHOLDER_TOKENS:
        if token.lower() in lowered:
            return True
    return False


def _ensure_required(env: Mapping[str, str], errors: list[str]) -> None:
    for key in REQUIRED_VARS:
        raw = env.get(key, "").strip()
        if not raw:
            errors.append(f"{key} must be set before running the stack helper")
        elif _looks_like_placeholder(raw):
            errors.append(f"{key} still uses a placeholder value; generate a unique secret")


def _validate_password(password: str | None, errors: list[str]) -> None:
    if not password:
        return
    if len(password) < MIN_PASSWORD_LENGTH:
        errors.append("POSTGRES_PASSWORD must be at least 12 characters long")


def _validate_database_url(env: Mapping[str, str], errors: list[str]) -> None:
    url = env.get("DATABASE_URL")
    if not url:
        return
    parsed = urlsplit(url)
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_DATABASE_SCHEMES:
        errors.append(
            "DATABASE_URL must use the postgresql+asyncpg scheme (or postgresql for sync clients)"
        )
        return
    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    database = (parsed.path or "").lstrip("/")
    # Track mismatches with the discrete env vars so compose gets a consistent configuration.
    expected_user = env.get("POSTGRES_USER", "")
    expected_password = env.get("POSTGRES_PASSWORD", "")
    expected_db = env.get("POSTGRES_DB", "")
    if expected_user and not username:
        errors.append("DATABASE_URL must include a username when POSTGRES_USER is set")
    elif username and expected_user and username != expected_user:
        errors.append(
            "DATABASE_URL username does not match POSTGRES_USER; update one of them"
        )
    if expected_password and not password:
        errors.append("DATABASE_URL must include a password when POSTGRES_PASSWORD is set")
    elif password and expected_password and password != expected_password:
        errors.append(
            "DATABASE_URL password does not match POSTGRES_PASSWORD; update one of them"
        )
    if database and expected_db and database != expected_db:
        errors.append(
            "DATABASE_URL database name does not match POSTGRES_DB; update one of them"
        )
    if _looks_like_placeholder(username) or _looks_like_placeholder(password):
        errors.append("DATABASE_URL still contains placeholder credentials; replace them")


def validate_postgres_env(env: Mapping[str, str] | None = None) -> None:
    env_map = env or os.environ
    # Build a fresh list so tests can assert on deterministic messaging.
    issues: list[str] = []
    _ensure_required(env_map, issues)
    _validate_password(env_map.get("POSTGRES_PASSWORD"), issues)
    _validate_database_url(env_map, issues)
    if issues:
        raise PostgresEnvError(tuple(issues))


def main(argv: Iterable[str] | None = None) -> int:  # pragma: no cover - exercised via CLI wrapper
    try:
        validate_postgres_env()
    except PostgresEnvError as exc:  # pragma: no cover - behaviour verified through tests
        print("Postgres credential validation failed:", file=sys.stderr)
        for line in exc.errors:
            print(f"  - {line}", file=sys.stderr)
        print(
            "Update .env (or the invoking environment) before rerunning ./bootstrap-stack.sh.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover - manual execution path
    raise SystemExit(main())
