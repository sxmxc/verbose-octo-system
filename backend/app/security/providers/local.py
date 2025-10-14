from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

try:  # pragma: no cover - import shim for optional FastAPI dependency
    from fastapi import HTTPException, Request, status
except ModuleNotFoundError:  # pragma: no cover
    # FastAPI is an optional dependency during unit testing.  When it is not
    # installed we fall back to the underlying Starlette primitives that
    # FastAPI re-exports so the provider can still operate.
    from starlette import status
    from starlette.exceptions import HTTPException
    from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis

from ...config import LocalAuthProvider as LocalAuthConfig
from ...core.redis import get_redis
from ...models.user import User
from ...services.audit import AuditService
from ...services.users import UserService
from ..passwords import verify_password
from ..throttling import LoginThrottleConfig, check_lockout, record_failure, reset_attempts
from .base import AuthProvider, AuthResult


class LocalAuthProvider(AuthProvider):
    config_model = LocalAuthConfig

    def _throttle_config(self) -> LoginThrottleConfig:
        return LoginThrottleConfig.from_provider(self.config)

    def _throttle_identifier(self, username: str, client_ip: Optional[str]) -> str:
        username = (username or "").strip().lower()
        if username:
            return username
        return (client_ip or "").strip().lower()

    async def _register_failure(
        self,
        *,
        redis_client: Optional[Redis],
        throttle_config: LoginThrottleConfig,
        audit_service: AuditService,
        identifier: str,
        actor: Optional[User],
        username: str,
        reason: str,
        client_ip: Optional[str],
        user_agent: Optional[str],
    ) -> Tuple[bool, int]:
        await audit_service.log(
            actor=actor,
            event="auth.login.failed",
            payload={
                "provider": self.name,
                "username": username,
                "reason": reason,
            },
            source_ip=client_ip,
            user_agent=user_agent,
        )

        if not throttle_config.enabled or redis_client is None:
            return False, throttle_config.max_attempts

        locked, metric = record_failure(redis_client, identifier, throttle_config)
        if locked:
            await audit_service.log(
                actor=actor,
                event="auth.login.throttled",
                payload={
                    "provider": self.name,
                    "username": username,
                    "reason": "rate_limited",
                    "lockout_seconds": metric,
                },
                source_ip=client_ip,
                user_agent=user_agent,
            )
        return locked, metric

    def _clear_failures(self, redis_client: Optional[Redis], identifier: str) -> None:
        if redis_client is None:
            return
        reset_attempts(redis_client, identifier)

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
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        throttle_config = self._throttle_config()
        redis_client: Optional[Redis] = get_redis() if throttle_config.enabled else None
        identifier = self._throttle_identifier(username, client_ip)

        if redis_client is not None:
            lockout_ttl = check_lockout(redis_client, identifier)
            if lockout_ttl > 0:
                await audit_service.log(
                    actor=None,
                    event="auth.login.lockout",
                    payload={
                        "provider": self.name,
                        "username": username,
                        "reason": "lockout_active",
                        "lockout_seconds": lockout_ttl,
                    },
                    source_ip=client_ip,
                    user_agent=user_agent,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(lockout_ttl)},
                )

        user: User | None = await user_service.get_by_username(username)
        if not user or not verify_password(password, user.password_hash):
            locked, metric = await self._register_failure(
                redis_client=redis_client,
                throttle_config=throttle_config,
                audit_service=audit_service,
                identifier=identifier,
                actor=user,
                username=username,
                reason="invalid_credentials",
                client_ip=client_ip,
                user_agent=user_agent,
            )
            if locked:
                retry_after = metric if metric and metric > 0 else throttle_config.lockout_seconds
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

        if not user.is_active:
            locked, metric = await self._register_failure(
                redis_client=redis_client,
                throttle_config=throttle_config,
                audit_service=audit_service,
                identifier=identifier,
                actor=user,
                username=username,
                reason="disabled_account",
                client_ip=client_ip,
                user_agent=user_agent,
            )
            if locked or metric < throttle_config.max_attempts:
                retry_after = metric if metric and metric > 0 else throttle_config.lockout_seconds
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Try again later.",
                    headers={"Retry-After": str(retry_after)},
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
