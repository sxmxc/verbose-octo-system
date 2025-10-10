from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import LocalAuthProvider as LocalAuthConfig
from ...core.redis import get_redis, redis_key
from ...models.user import User
from ...services.audit import AuditService
from ...services.users import UserService
from ..passwords import verify_password
from .base import AuthProvider, AuthResult


class LocalAuthProvider(AuthProvider):
    config_model = LocalAuthConfig

    def _throttle_identifier(self, username: str, client_ip: str | None) -> str:
        identifier = username.lower()
        return f"{identifier}:{client_ip}" if client_ip else identifier

    def _failure_key(self, identifier: str) -> str:
        return redis_key("auth", "local", "failures", identifier)

    def _lock_key(self, identifier: str) -> str:
        return redis_key("auth", "local", "lock", identifier)

    def _remaining_lock_seconds(self, redis_client: Any, identifier: str) -> int:
        lock_key = self._lock_key(identifier)
        if redis_client.get(lock_key) is None:
            return 0
        ttl = redis_client.ttl(lock_key)
        if ttl is None or ttl < 0:
            return self.config.lockout_seconds
        return ttl

    async def _register_failure(
        self,
        *,
        redis_client: Any,
        identifier: str,
        audit_service: AuditService,
        actor: User | None,
        username: str,
        reason: str,
        client_ip: str | None,
        user_agent: str | None,
    ) -> int:
        await audit_service.log(
            actor=actor,
            event="auth.login.failure",
            severity="warning",
            payload={"provider": self.name, "username": username, "reason": reason},
            source_ip=client_ip,
            user_agent=user_agent,
        )
        if not identifier:
            return 0

        failure_key = self._failure_key(identifier)
        attempts = redis_client.incr(failure_key)
        ttl = redis_client.ttl(failure_key)
        if ttl is None or ttl < 0:
            redis_client.expire(failure_key, self.config.failure_window_seconds)
        if attempts >= self.config.max_failed_attempts:
            lock_key = self._lock_key(identifier)
            redis_client.setex(lock_key, self.config.lockout_seconds, "1")
            redis_client.delete(failure_key)
            await audit_service.log(
                actor=actor,
                event="auth.login.throttled",
                severity="warning",
                payload={
                    "provider": self.name,
                    "username": username,
                    "reason": "rate_limited",
                    "lockout_seconds": self.config.lockout_seconds,
                },
                source_ip=client_ip,
                user_agent=user_agent,
            )
            return self._remaining_lock_seconds(redis_client, identifier)
        return 0

    def _clear_failures(self, redis_client: Any, identifier: str) -> None:
        if not identifier:
            return
        redis_client.delete(self._failure_key(identifier))
        redis_client.delete(self._lock_key(identifier))

    async def begin(self, request: Request) -> Dict[str, Any]:
        # Local auth happens inline; nothing to begin.
        return {"type": "form"}

    async def complete(self, request: Request, session: AsyncSession) -> AuthResult:
        form = await request.json()
        username = (form.get("username") or "").strip()
        password = form.get("password") or ""
        if not username or not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing credentials")
        user_service = UserService(session)
        audit_service = AuditService(session)
        redis_client = get_redis()
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        identifier = self._throttle_identifier(username, client_ip)

        remaining_lock = self._remaining_lock_seconds(redis_client, identifier)
        if remaining_lock > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again later.",
                headers={"Retry-After": str(remaining_lock)},
            )

        user: User | None = await user_service.get_by_username(username)
        if not user or not verify_password(password, user.password_hash):
            remaining = await self._register_failure(
                redis_client=redis_client,
                identifier=identifier,
                audit_service=audit_service,
                actor=user,
                username=username,
                reason="invalid_credentials",
                client_ip=client_ip,
                user_agent=user_agent,
            )
            if remaining > 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(remaining)},
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        if not user.is_active:
            remaining = await self._register_failure(
                redis_client=redis_client,
                identifier=identifier,
                audit_service=audit_service,
                actor=user,
                username=username,
                reason="disabled_account",
                client_ip=client_ip,
                user_agent=user_agent,
            )
            if remaining > 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(remaining)},
                )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")

        await user_service.mark_login(user)
        self._clear_failures(redis_client, identifier)
        roles = [role.slug for role in user.roles] or self.default_roles
        return AuthResult(
            user_external_id=user.id,
            username=user.username,
            email=user.email,
            display_name=user.display_name,
            provider_name=self.name,
            attributes={},
            roles=roles,
        )
