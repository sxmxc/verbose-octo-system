from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Iterable, Sequence

from sqlalchemy import inspect, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import AuditLog, Role, SsoIdentity, User
from ..security.roles import ROLE_DEFINITIONS


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).options(selectinload(User.roles)).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).options(selectinload(User.roles)).where(User.username == username)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).options(selectinload(User.roles)).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_identity(self, provider: str, subject: str) -> User | None:
        stmt = (
            select(User)
            .options(selectinload(User.roles))
            .join(SsoIdentity)
            .where(SsoIdentity.provider == provider)
            .where(SsoIdentity.subject == subject)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def ensure_roles(self, slugs: Sequence[str]) -> list[Role]:
        existing_stmt = select(Role).where(Role.slug.in_(slugs))
        result = await self.session.execute(existing_stmt)
        existing = {role.slug: role for role in result.scalars().all()}
        roles: list[Role] = []
        for slug in slugs:
            role = existing.get(slug)
            if not role:
                definition = ROLE_DEFINITIONS.get(slug)
                role = Role(
                    slug=slug,
                    name=definition.name if definition else slug.replace("_", " ").title(),
                    description=definition.description if definition else None,
                )
                self.session.add(role)
            roles.append(role)
        return roles

    async def assign_roles(self, user: User, role_slugs: Iterable[str]) -> None:
        desired = set(role_slugs)
        if not desired:
            return
        state = inspect(user)
        if "roles" in state.unloaded:
            await self.session.refresh(user, attribute_names=["roles"])
        current = {role.slug for role in user.roles}
        if desired <= current:
            return
        roles = await self.ensure_roles(list(desired))
        for role in roles:
            if role.slug not in current:
                user.roles.append(role)

    async def create_local_user(
        self,
        username: str,
        password_hash: str,
        *,
        email: str | None = None,
        display_name: str | None = None,
        roles: Iterable[str] | None = None,
        is_superuser: bool = False,
    ) -> User:
        user = User(
            username=username,
            email=email,
            display_name=display_name,
            password_hash=password_hash,
            is_superuser=is_superuser,
        )
        self.session.add(user)
        await self.session.flush()
        if roles:
            await self.assign_roles(user, roles)
        return user

    async def link_identity(
        self,
        user: User,
        provider: str,
        subject: str,
        *,
        attributes: dict | None = None,
    ) -> None:
        payload = json.dumps(attributes or {}, ensure_ascii=False)
        identity = SsoIdentity(
            provider=provider,
            subject=subject,
            user=user,
            raw_attributes=payload,
        )
        self.session.add(identity)

    async def mark_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)

    async def audit(self, *, user: User | None, event: str, payload: dict | None = None) -> None:
        record = AuditLog(
            user_id=user.id if user else None,
            event=event,
            payload=json.dumps(payload or {}, ensure_ascii=False) if payload else None,
        )
        self.session.add(record)

    async def list_users(self) -> list[User]:
        stmt = select(User).options(selectinload(User.roles))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_roles(self) -> list[Role]:
        result = await self.session.execute(select(Role))
        return list(result.scalars().all())

    async def set_roles(self, user: User, role_slugs: Iterable[str]) -> None:
        desired = set(role_slugs)
        user.roles = [role for role in user.roles if role.slug in desired]
        await self.assign_roles(user, desired)

    async def delete_user(self, user: User) -> None:
        await self.session.delete(user)
