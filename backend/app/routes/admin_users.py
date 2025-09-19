from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_session
from ..models.user import User
from ..schemas.user import UserCreateRequest, UserImportRequest, UserResponse, UserUpdateRequest
from ..security.dependencies import require_roles
from ..security.roles import ROLE_SYSTEM_ADMIN, ROLE_TOOLKIT_CURATOR
from ..security.passwords import hash_password
from ..security.registry import get_provider
from ..services.users import UserService

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


def _serialize_user(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        roles=[role.slug for role in user.roles],
        is_superuser=user.is_superuser,
        is_active=user.is_active,
    )


@router.get("/", response_model=List[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> List[UserResponse]:
    service = UserService(session)
    users = await service.list_users()
    return [_serialize_user(user) for user in users]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> UserResponse:
    service = UserService(session)
    existing = await service.get_by_username(payload.username)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    if payload.is_superuser and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superuser privilege required")
    password_hash = hash_password(payload.password)
    user = await service.create_local_user(
        username=payload.username,
        password_hash=password_hash,
        email=payload.email,
        display_name=payload.display_name,
        roles=payload.roles,
        is_superuser=payload.is_superuser,
    )
    await session.commit()
    return _serialize_user(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> UserResponse:
    service = UserService(session)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.roles is not None:
        if ROLE_SYSTEM_ADMIN in payload.roles and not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign system admin role")
        await service.set_roles(user, payload.roles)
    if payload.email is not None:
        user.email = payload.email
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_superuser is not None:
        if not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify superuser flag")
        user.is_superuser = payload.is_superuser
    await session.commit()
    await session.refresh(user)
    return _serialize_user(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> Response:
    service = UserService(session)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await service.delete_user(user)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=List[UserResponse])
async def import_users(
    payload: UserImportRequest,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> List[UserResponse]:
    provider = get_provider(payload.provider)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not configured")
    service = UserService(session)
    created_users: List[UserResponse] = []
    for entry in payload.entries:
        user = await service.find_by_identity(provider.name, entry.external_id)
        if user:
            pass
        else:
            user = await service.get_by_username(entry.username)
            if not user:
                user = User(
                    username=entry.username,
                    email=entry.email,
                    display_name=entry.display_name,
                    password_hash=None,
                    is_active=True,
                    is_superuser=False,
                )
                session.add(user)
                await session.flush()
            roles_to_apply = entry.roles or provider.default_roles
            if roles_to_apply:
                await service.assign_roles(user, roles_to_apply)
            await service.link_identity(
                user,
                provider=provider.name,
                subject=entry.external_id,
                attributes={"imported": True},
            )
            await service.audit(
                user=user,
                event="import_user",
                payload={"provider": provider.name, "external_id": entry.external_id},
            )
        created_users.append(_serialize_user(user))
    await session.commit()
    return created_users
