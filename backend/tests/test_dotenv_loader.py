import pytest

from app.core import dotenv_loader


def write_env(tmp_path, content):
    path = tmp_path / ".env"
    path.write_text(content)
    return path


def write_env_lines(tmp_path, lines):
    return write_env(tmp_path, "\n".join([*lines, ""]))


def test_parse_unquoted_value_with_spaces(tmp_path):
    env_path = write_env(tmp_path, "APP_NAME=SRE Toolbox\n")
    data = dotenv_loader.parse_env_file(env_path)
    assert data["APP_NAME"] == "SRE Toolbox"


def test_parse_trims_inline_comment(tmp_path):
    env_path = write_env(tmp_path, "LOG_LEVEL=INFO # comment\n")
    data = dotenv_loader.parse_env_file(env_path)
    assert data["LOG_LEVEL"] == "INFO"


def test_parse_preserves_hash_inside_quotes(tmp_path):
    env_path = write_env(tmp_path, 'APP_NAME="SRE Toolbox #1"\n')
    data = dotenv_loader.parse_env_file(env_path)
    assert data["APP_NAME"] == "SRE Toolbox #1"


def test_parse_supports_export_prefix(tmp_path):
    env_path = write_env(tmp_path, "export REDIS_URL=redis://redis:6379/0\n")
    data = dotenv_loader.parse_env_file(env_path)
    assert data["REDIS_URL"] == "redis://redis:6379/0"


def test_invalid_line_raises(tmp_path):
    env_path = write_env(tmp_path, "Toolbox version\n")
    with pytest.raises(dotenv_loader.DotenvError):
        dotenv_loader.parse_env_file(env_path)


def test_parse_interpolates_references(tmp_path):
    env_path = write_env_lines(tmp_path, [
        "POSTGRES_USER=toolbox",
        "POSTGRES_PASSWORD=secret123",
        "DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/toolbox",
    ])
    data = dotenv_loader.parse_env_file(env_path)
    assert data["DATABASE_URL"] == "postgresql+asyncpg://toolbox:secret123@db:5432/toolbox"


def test_parse_interpolation_supports_late_definition(tmp_path):
    env_path = write_env_lines(tmp_path, [
        "DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db",
        "POSTGRES_USER=toolbox",
        "POSTGRES_PASSWORD=secret",
    ])
    data = dotenv_loader.parse_env_file(env_path)
    assert data["DATABASE_URL"] == "postgresql://toolbox:secret@db"


def test_parse_interpolation_raises_on_unknown_key(tmp_path):
    env_path = write_env_lines(tmp_path, [
        "DATABASE_URL=postgresql://${MISSING}@db",
    ])
    with pytest.raises(dotenv_loader.DotenvError):
        dotenv_loader.parse_env_file(env_path)

def test_parse_interpolation_detects_cycle(tmp_path):
    env_path = write_env_lines(tmp_path, [
        "A=${B}",
        "B=${A}",
    ])
    with pytest.raises(dotenv_loader.DotenvError):
        dotenv_loader.parse_env_file(env_path)


def test_parse_interpolation_preserves_escaped_sequence(tmp_path):
    env_path = write_env_lines(tmp_path, [
        r"PASSWORD=\${SECRET}",
    ])
    data = dotenv_loader.parse_env_file(env_path)
    assert data["PASSWORD"] == r"${SECRET}"

