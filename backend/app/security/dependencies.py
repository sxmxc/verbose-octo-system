from __future__ import annotations

from typing import Awaitable, Callable, Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..models.user import User
from ..services.users import UserService
from .tokens import decode_token

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login/local")


async def get_current_user(
    token: str = Depends(_oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    service = UserService(session)
    user = await service.get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    return user


def require_roles(required_roles: Iterable[str]) -> Callable[..., Awaitable[User]]:
    required = set(required_roles)

    async def dependency(user: User = Depends(get_current_user)) -> User:
        if user.is_superuser:
            return user
        role_slugs = {role.slug for role in user.roles}
        if not required.issubset(role_slugs):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return dependency


async def require_superuser(user: User = Depends(get_current_user)) -> User:
    if user.is_superuser:
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superuser required")
