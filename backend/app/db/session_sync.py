from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session, sessionmaker

from ..config import settings


def _sync_database_url(async_url: str) -> str:
    url: URL = make_url(async_url)
    driver = url.drivername
    if "+asyncpg" in driver:
        driver = driver.replace("+asyncpg", "+psycopg")
    elif "+aiosqlite" in driver:
        driver = driver.replace("+aiosqlite", "")
    url = url.set(drivername=driver)
    return url.render_as_string(hide_password=False)


SYNC_DATABASE_URL = _sync_database_url(settings.database_url)

SYNC_ENGINE_KWARGS = {}
if SYNC_DATABASE_URL.startswith("sqlite"):
    SYNC_ENGINE_KWARGS["connect_args"] = {"check_same_thread": False}

sync_engine = create_engine(SYNC_DATABASE_URL, future=True, **SYNC_ENGINE_KWARGS)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False, class_=Session)


@contextmanager
def get_sync_session() -> Iterator[Session]:
    session = SyncSessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = ["get_sync_session", "sync_engine", "SyncSessionLocal", "SYNC_DATABASE_URL"]
