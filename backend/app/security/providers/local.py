from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

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
        redis_client = None
        if throttle_config.enabled:
            redis_client = get_redis()
            lockout_ttl = check_lockout(redis_client, username)
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
                    detail="Account temporarily locked due to too many failed login attempts.",
                )

        user: User | None = await user_service.get_by_username(username)
        if not user or not verify_password(password, user.password_hash):
            await audit_service.log(
                actor=user,
                event="auth.login.failure",
                severity="warning",
                payload={"provider": self.name, "username": username, "reason": "invalid_credentials"},
                source_ip=client_ip,
                user_agent=user_agent,
            )
            if throttle_config.enabled and redis_client is not None:
                locked, metric = record_failure(redis_client, username, throttle_config)
                if locked:
                    await audit_service.log(
                        actor=user,
                        event="auth.login.lockout",
                        payload={
                            "provider": self.name,
                            "username": username,
                            "reason": "lockout_threshold",
                            "lockout_seconds": metric,
                        },
                        source_ip=client_ip,
                        user_agent=user_agent,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Account temporarily locked due to too many failed login attempts.",
                    )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        if not user.is_active:
            await audit_service.log(
                actor=user,
                event="auth.login.failure",
                severity="warning",
                payload={"provider": self.name, "username": username, "reason": "disabled_account"},
                source_ip=client_ip,
                user_agent=user_agent,
            )
            if throttle_config.enabled and redis_client is not None:
                locked, metric = record_failure(redis_client, username, throttle_config)
                if locked:
                    await audit_service.log(
                        actor=user,
                        event="auth.login.lockout",
                        payload={
                            "provider": self.name,
                            "username": username,
                            "reason": "lockout_threshold",
                            "lockout_seconds": metric,
                        },
                        source_ip=client_ip,
                        user_agent=user_agent,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Account temporarily locked due to too many failed login attempts.",
                    )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")

        await user_service.mark_login(user)
        if throttle_config.enabled and redis_client is not None:
            reset_attempts(redis_client, username)
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
