from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import AuthSession, User
from ..security.providers.base import AuthProvider, AuthResult
from ..security.roles import ROLE_SYSTEM_ADMIN
from ..security.tokens import TokenBundle, create_token_bundle, decode_token, hash_token, is_token_expired
from .sessions import SessionService
from .users import UserService

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_service = UserService(session)
        self.session_service = SessionService(session)

    async def resolve_user(
        self,
        provider: AuthProvider,
        result: AuthResult,
        *,
        source_ip: str | None = None,
        user_agent: str | None = None,
    ) -> User:
        if provider.name == "local":
            user = await self.user_service.get_by_username(result.username)
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        else:
            user = await self.user_service.find_by_identity(provider.name, result.user_external_id)
            if not user:
                user = await self._provision_user_from_identity(provider, result)
        if result.email and user.email != result.email:
            user.email = result.email
        if result.display_name and user.display_name != result.display_name:
            user.display_name = result.display_name
        await self.user_service.assign_roles(user, result.roles)
        await self.user_service.mark_login(user)
        await self.user_service.audit(
            user=user,
            event="auth.login.success",
            payload={"provider": provider.name},
            source_ip=source_ip,
            user_agent=user_agent,
        )
        await self.session.flush()
        return user

    async def _provision_user_from_identity(self, provider: AuthProvider, result: AuthResult) -> User:
        username_candidate = result.username or result.email
        if not username_candidate:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot derive username from identity")
        username = await self._deduplicate_username(username_candidate)
        password_hash = None
        user = User(
            username=username,
            email=result.email,
            display_name=result.display_name,
            password_hash=password_hash,
            is_active=True,
            is_superuser=False,
        )
        self.session.add(user)
        await self.session.flush()
        await self.user_service.assign_roles(user, result.roles)
        await self.user_service.link_identity(user, provider.name, result.user_external_id, attributes=result.attributes)
        await self.user_service.audit(
            user=user,
            event="user.provision",
            payload={"provider": provider.name, "user_external_id": result.user_external_id},
        )
        return user

    async def _deduplicate_username(self, base_username: str) -> str:
        username = base_username
        attempt = 0
        while True:
            existing = await self.user_service.get_by_username(username)
            if not existing:
                return username
            attempt += 1
            username = f"{base_username}{attempt}"

    async def issue_tokens(
        self,
        user: User,
        provider: AuthProvider,
        *,
        client_info: str | None = None,
    ) -> TokenBundle:
        roles = [role.slug for role in user.roles]
        if user.is_superuser and ROLE_SYSTEM_ADMIN not in roles:
            roles.append(ROLE_SYSTEM_ADMIN)
        session_id = f"{user.id}:{datetime.now(timezone.utc).timestamp()}"
        bundle = create_token_bundle(
            user_id=user.id,
            roles=roles,
            identity_provider=provider.name,
            session_id=session_id,
            extra_claims={"name": user.display_name or user.username},
        )
        await self._store_refresh_token(
            user_id=user.id,
            refresh_token=bundle.refresh_token,
            expires_at=bundle.refresh_expires_at,
            client_info=client_info,
        )
        return bundle

    async def _store_refresh_token(
        self,
        *,
        user_id: str,
        refresh_token: str,
        expires_at: datetime,
        client_info: str | None,
    ) -> AuthSession:
        token_hash = hash_token(refresh_token)
        session_record = await self.session_service.get_by_token_hash(token_hash)
        if session_record:
            if session_record.user_id != user_id:
                await self.session.delete(session_record)
            else:
                session_record.expires_at = expires_at
                session_record.revoked_at = None
                session_record.client_info = client_info
                return session_record
        return await self.session_service.create_session(
            user_id=user_id,
            refresh_token_hash=token_hash,
            expires_at=expires_at,
            client_info=client_info,
        )

    async def refresh_tokens(
        self,
        refresh_token: str,
        *,
        source_ip: str | None = None,
        user_agent: str | None = None,
    ) -> TokenBundle:
        payload = decode_token(refresh_token)
        if payload.get("token_use") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid")
        if payload.get("typ") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid")
        token_hash = hash_token(refresh_token)
        record = await self.session_service.get_by_token_hash(token_hash)
        if not record or record.revoked_at:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not recognized")
        if is_token_expired(record.expires_at):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")
        user = await self.user_service.get_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
        provider_name = payload.get("provider", "local")
        bundle = create_token_bundle(
            user_id=user.id,
            roles=[role.slug for role in user.roles],
            identity_provider=provider_name,
            session_id=payload.get("sid", record.id),
            extra_claims={"name": user.display_name or user.username},
        )
        record.refresh_token_hash = hash_token(bundle.refresh_token)
        record.expires_at = bundle.refresh_expires_at
        await self.session.flush()
        await self.user_service.audit(
            user=user,
            event="auth.token.refresh",
            payload={"provider": provider_name, "session_id": payload.get("sid", record.id)},
            source_ip=source_ip,
            user_agent=user_agent,
        )
        return bundle

    async def revoke_refresh_token(self, refresh_token: str) -> None:
        token_hash = hash_token(refresh_token)
        record = await self.session_service.get_by_token_hash(token_hash)
        if record:
            record.revoked_at = datetime.now(timezone.utc)

    async def logout_all_sessions(self, user: User) -> None:
        stmt = select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        result = await self.session.execute(stmt)
        for session_record in result.scalars().all():
            session_record.revoked_at = datetime.now(timezone.utc)
