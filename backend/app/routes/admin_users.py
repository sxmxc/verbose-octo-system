from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
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
    request: Request,
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
    await service.audit(
        user=user,
        actor=current_user,
        event="user.create",
        payload={
            "created_user_id": user.id,
            "roles": payload.roles,
            "is_superuser": payload.is_superuser,
        },
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return _serialize_user(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> UserResponse:
    service = UserService(session)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    source_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    previous_roles = sorted(role.slug for role in user.roles)
    previous_email = user.email
    previous_display_name = user.display_name
    previous_active = user.is_active
    previous_superuser = user.is_superuser
    roles_changed = False
    if payload.roles is not None:
        if ROLE_SYSTEM_ADMIN in payload.roles and not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign system admin role")
        await service.set_roles(user, payload.roles)
        updated_roles = sorted(role.slug for role in user.roles)
        roles_changed = updated_roles != previous_roles
    else:
        updated_roles = previous_roles
    profile_changes = {}
    if payload.email is not None and payload.email != previous_email:
        user.email = payload.email
        profile_changes["email"] = {"from": previous_email, "to": payload.email}
    if payload.display_name is not None and payload.display_name != previous_display_name:
        user.display_name = payload.display_name
        profile_changes["display_name"] = {"from": previous_display_name, "to": payload.display_name}
    status_change = None
    if payload.is_active is not None and payload.is_active != previous_active:
        user.is_active = payload.is_active
        status_change = {"from": previous_active, "to": payload.is_active}
    privilege_change = None
    if payload.is_superuser is not None and payload.is_superuser != previous_superuser:
        if not current_user.is_superuser:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify superuser flag")
        user.is_superuser = payload.is_superuser
        privilege_change = {"from": previous_superuser, "to": payload.is_superuser}
    if profile_changes:
        await service.audit(
            user=user,
            actor=current_user,
            event="user.update",
            payload={"changes": profile_changes},
            source_ip=source_ip,
            user_agent=user_agent,
        )
    if status_change is not None:
        await service.audit(
            user=user,
            actor=current_user,
            event="user.status.update",
            payload=status_change,
            source_ip=source_ip,
            user_agent=user_agent,
        )
    if roles_changed or privilege_change:
        payload_details = {
            "previous_roles": previous_roles,
            "roles": updated_roles,
        }
        if privilege_change:
            payload_details["superuser"] = privilege_change
        await service.audit(
            user=user,
            actor=current_user,
            event="user.roles.update",
            payload=payload_details,
            source_ip=source_ip,
            user_agent=user_agent,
        )
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
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> Response:
    service = UserService(session)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await service.delete_user(user)
    await service.audit(
        user=user,
        actor=current_user,
        event="user.delete",
        payload={"deleted_user_id": user.id, "username": user.username},
        source_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=List[UserResponse])
async def import_users(
    payload: UserImportRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
) -> List[UserResponse]:
    provider = get_provider(payload.provider)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not configured")
    service = UserService(session)
    source_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    created_users: List[UserResponse] = []
    for entry in payload.entries:
        user = await service.find_by_identity(provider.name, entry.external_id)
        outcome = "existing_identity"
        roles_applied: List[str] = []
        was_created = False
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
                was_created = True
                outcome = "created"
            else:
                outcome = "linked_identity"
            roles_to_apply = entry.roles or provider.default_roles
            if roles_to_apply:
                await service.assign_roles(user, roles_to_apply)
                roles_applied = list(roles_to_apply)
            await service.link_identity(
                user,
                provider=provider.name,
                subject=entry.external_id,
                attributes={"imported": True},
            )
        await service.audit(
            user=user,
            actor=current_user,
            event="user.import",
            payload={
                "provider": provider.name,
                "external_id": entry.external_id,
                "username": entry.username,
                "outcome": outcome,
                "created": was_created,
                "roles_applied": roles_applied,
            },
            source_ip=source_ip,
            user_agent=user_agent,
        )
        created_users.append(_serialize_user(user))
    await session.commit()
    return created_users
