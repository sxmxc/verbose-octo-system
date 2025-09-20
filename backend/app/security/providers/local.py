from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import LocalAuthProvider as LocalAuthConfig
from ...models.user import User
from ...services.audit import AuditService
from ...services.users import UserService
from ..passwords import verify_password
from .base import AuthProvider, AuthResult


class LocalAuthProvider(AuthProvider):
    config_model = LocalAuthConfig
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User disabled")

        await user_service.mark_login(user)
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
