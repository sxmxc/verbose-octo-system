from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..config import settings
from .base import Base

logger = logging.getLogger(__name__)


def _make_engine() -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        echo=settings.log_level.upper() == "DEBUG",
        future=True,
    )


def _make_session_factory(bind: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind, expire_on_commit=False)


engine: AsyncEngine = _make_engine()
SessionLocal: async_sessionmaker[AsyncSession] = _make_session_factory(engine)


async def init_db() -> None:
    # Import models so SQLAlchemy metadata is populated before create_all
    from .. import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.debug("Database schema ensured")


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
