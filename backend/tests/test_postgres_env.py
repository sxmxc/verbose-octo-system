from __future__ import annotations

from typing import Dict

import pytest

from app.core.postgres_env import PostgresEnvError, validate_postgres_env


@pytest.fixture(name="valid_env")
def _valid_env() -> Dict[str, str]:
    return {
        "POSTGRES_USER": "toolbox_admin",
        "POSTGRES_PASSWORD": "S0m3-Super-Secret!",
        "POSTGRES_DB": "toolbox",
        "DATABASE_URL": "postgresql+asyncpg://toolbox_admin:S0m3-Super-Secret!@db:5432/toolbox",
    }


def test_validate_postgres_env_accepts_secure_values(valid_env: Dict[str, str]) -> None:
    validate_postgres_env(valid_env)


def test_validate_postgres_env_rejects_missing_fields(valid_env: Dict[str, str]) -> None:
    del valid_env["POSTGRES_PASSWORD"]
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    assert "POSTGRES_PASSWORD must be set" in "\n".join(exc.value.errors)


def test_validate_postgres_env_rejects_placeholder_password(valid_env: Dict[str, str]) -> None:
    valid_env["POSTGRES_PASSWORD"] = "CHANGE_ME_POSTGRES_PASSWORD"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    joined = "\n".join(exc.value.errors)
    assert "placeholder" in joined


def test_validate_postgres_env_rejects_short_password(valid_env: Dict[str, str]) -> None:
    valid_env["POSTGRES_PASSWORD"] = "short_pwd"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    assert "at least 12" in "\n".join(exc.value.errors)


def test_validate_postgres_env_requires_database_url_alignment(valid_env: Dict[str, str]) -> None:
    valid_env["DATABASE_URL"] = "postgresql+asyncpg://other_user:S0m3-Super-Secret!@db:5432/toolbox"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    assert "username does not match" in "\n".join(exc.value.errors)


def test_validate_postgres_env_rejects_placeholder_in_database_url(valid_env: Dict[str, str]) -> None:
    valid_env["DATABASE_URL"] = "postgresql+asyncpg://toolbox_admin:CHANGE_ME_POSTGRES_PASSWORD@db:5432/toolbox"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    joined = "\n".join(exc.value.errors)
    assert "placeholder credentials" in joined


def test_validate_postgres_env_requires_database_url_credentials(valid_env: Dict[str, str]) -> None:
    valid_env["DATABASE_URL"] = "postgresql+asyncpg://db:5432/toolbox"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    joined = "\n".join(exc.value.errors)
    assert "must include a username" in joined
    assert "must include a password" in joined


def test_validate_postgres_env_allows_plain_postgresql_scheme(valid_env: Dict[str, str]) -> None:
    valid_env["DATABASE_URL"] = "postgresql://toolbox_admin:S0m3-Super-Secret!@db:5432/toolbox"
    validate_postgres_env(valid_env)


def test_main_reads_process_environment(valid_env: Dict[str, str], monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in valid_env.items():
        monkeypatch.setenv(key, value)
    # Should not raise when env vars are set on the process.
    validate_postgres_env(None)


def test_validate_postgres_env_rejects_placeholder_database_name(valid_env: Dict[str, str]) -> None:
    valid_env["POSTGRES_DB"] = "__REPLACE_WITH_DB__"
    valid_env["DATABASE_URL"] = "postgresql+asyncpg://toolbox_admin:S0m3-Super-Secret!@db:5432/__REPLACE_WITH_DB__"
    with pytest.raises(PostgresEnvError) as exc:
        validate_postgres_env(valid_env)
    joined = "\n".join(exc.value.errors)
    assert "placeholder" in joined
