from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .security.passwords import hash_password
from .security.roles import DEFAULT_ROLE_SLUGS, ROLE_DEFINITIONS, ROLE_SYSTEM_ADMIN
from .services.users import UserService

logger = logging.getLogger(__name__)


async def ensure_core_roles(session: AsyncSession) -> None:
    service = UserService(session)
    await service.ensure_roles(list(ROLE_DEFINITIONS.keys()))
    await session.commit()


async def bootstrap_admin_user(session: AsyncSession) -> None:
    username = settings.bootstrap_admin_username
    password = settings.bootstrap_admin_password.get_secret_value() if settings.bootstrap_admin_password else None
    if not username or not password:
        return
    service = UserService(session)
    existing = await service.get_by_username(username)
    if existing:
        return
    email = settings.bootstrap_admin_email
    password_hash = hash_password(password)
    user = await service.create_local_user(
        username=username,
        password_hash=password_hash,
        email=email,
        roles=[ROLE_SYSTEM_ADMIN, *DEFAULT_ROLE_SLUGS],
        is_superuser=True,
    )
    await service.audit(user=user, event="user.bootstrap", payload={"username": username})
    await session.commit()
    logger.info("Bootstrapped initial admin user %s", user.username)
