from __future__ import annotations

from typing import Any, Dict

import json
import base64
from urllib.parse import (
    urlparse,
    urlunparse,
    urlencode,
    parse_qsl,
    urlsplit,
    urlunsplit,
)

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..services.auth import AuthService
from ..services.users import UserService
from ..security.dependencies import get_current_user
from ..security.registry import get_provider, list_provider_metadata
from ..security.state import verify_state
from ..security.tokens import TokenBundle, TokenError, decode_token
from ..db.session import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, bundle: TokenBundle) -> None:
    max_age = settings.auth_refresh_token_ttl_seconds
    response.set_cookie(
        "refresh_token",
        bundle.refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        domain=settings.auth_cookie_domain,
        path="/auth/refresh",
    )


def _serialize_login_payload(user, bundle: TokenBundle) -> Dict[str, Any]:
    return {
        "access_token": bundle.access_token,
        "token_type": bundle.token_type,
        "expires_at": bundle.access_expires_at.isoformat(),
        "user": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "email": user.email,
            "roles": [role.slug for role in user.roles],
            "is_superuser": user.is_superuser,
        },
    }


async def _complete_provider_login(
    provider,
    request: Request,
    session: AsyncSession,
) -> tuple[Any, TokenBundle, Dict[str, Any]]:
    auth_service = AuthService(session)
    try:
        auth_result = await provider.complete(request, session)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        user = await auth_service.resolve_user(
            provider,
            auth_result,
            source_ip=client_ip,
            user_agent=user_agent,
        )
        bundle = await auth_service.issue_tokens(
            user,
            provider,
            client_info=user_agent,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    payload = _serialize_login_payload(user, bundle)
    return user, bundle, payload


def _default_redirect_target(request: Request) -> tuple[str, set[str]]:
    """Determine the default redirect target and allowed origins."""

    allowed_origins: set[str] = set()
    default_target: str | None = None

    if settings.frontend_base_url:
        candidate = str(settings.frontend_base_url).strip()
        if candidate:
            parsed = urlsplit(candidate)
            if parsed.scheme and parsed.netloc:
                origin = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
                allowed_origins.add(origin)
                path = parsed.path or "/"
                default_target = urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
            elif candidate.startswith("/"):
                base_parts = urlsplit(str(request.base_url))
                origin = urlunsplit((base_parts.scheme, base_parts.netloc, "", "", ""))
                allowed_origins.add(origin)
                default_target = urlunsplit((base_parts.scheme, base_parts.netloc, candidate, "", ""))

    request_parts = urlsplit(str(request.base_url))
    request_origin = urlunsplit((request_parts.scheme, request_parts.netloc, "", "", ""))
    allowed_origins.add(request_origin)

    if not default_target:
        path = request_parts.path or "/"
        default_target = urlunsplit((request_parts.scheme, request_parts.netloc, path, "", ""))

    return default_target, allowed_origins


def _resolve_redirect_target(request: Request, candidate: str | None) -> str:
    """Return a safe redirect target limited to trusted origins."""

    default_target, allowed_origins = _default_redirect_target(request)
    default_parts = urlsplit(default_target)

    if candidate:
        trimmed = candidate.strip()
        if trimmed:
            parsed = urlsplit(trimmed)
            # Reject non-http(s) schemes outright.
            if parsed.scheme and parsed.scheme not in {"http", "https"}:
                return default_target

            if parsed.netloc:
                origin = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
                if origin in allowed_origins:
                    path = parsed.path or "/"
                    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))
                return default_target

            if parsed.scheme and not parsed.netloc:
                # Schemes without network locations (e.g. mailto) are not allowed.
                return default_target

            path = parsed.path or "/"
            if not path.startswith("/"):
                path = f"/{path}"
            return urlunsplit(
                (
                    default_parts.scheme,
                    default_parts.netloc,
                    path,
                    parsed.query,
                    parsed.fragment,
                )
            )

    return default_target


@router.get("/providers", summary="List authentication providers")
async def list_providers() -> Dict[str, Any]:
    return {"providers": list_provider_metadata()}


@router.post("/providers/{provider_name}/begin", summary="Initiate SSO flow")
async def begin_provider_flow(provider_name: str, request: Request) -> Dict[str, Any]:
    provider = get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    result = await provider.begin(request)
    return result


async def _handle_provider_callback(
    provider_name: str,
    request: Request,
    session: AsyncSession,
) -> Response:
    provider = get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    state_data: Dict[str, Any] | None = None
    user, bundle, payload = await _complete_provider_login(provider, request, session)
    response: Response
    # Attempt to recover state context for redirect/popup handling.
    state_token = request.query_params.get("state")
    if state_token:
        try:
            state_data = verify_state(state_token, max_age=settings.auth_sso_state_ttl_seconds)
        except ValueError:
            state_data = None
    target = _resolve_redirect_target(request, state_data.get("next") if state_data else None)

    try:
        encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    except Exception:  # pragma: no cover - defensive encoding fallback
        encoded_payload = ""

    parsed = urlparse(target)
    fragment_params = dict(parse_qsl(parsed.fragment))
    if encoded_payload:
        fragment_params["auth"] = encoded_payload
    rebuilt_fragment = urlencode(fragment_params)
    rebuilt_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.params, parsed.query, rebuilt_fragment))
    response = RedirectResponse(url=rebuilt_url, status_code=status.HTTP_303_SEE_OTHER)
    _set_refresh_cookie(response, bundle)
    return response


@router.get("/providers/{provider_name}/callback", summary="Complete SSO callback")
async def provider_callback(
    provider_name: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    return await _handle_provider_callback(provider_name, request, session)


@router.get(
    "/sso/{provider_name}/callback",
    summary="Complete SSO callback (SSO redirect endpoint)",
)
async def provider_sso_callback(
    provider_name: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    return await _handle_provider_callback(provider_name, request, session)


@router.post("/login/{provider_name}", summary="Authenticate using provider")
async def login_with_provider(
    provider_name: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    provider = get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    _, bundle, payload = await _complete_provider_login(provider, request, session)
    response = JSONResponse(payload)
    _set_refresh_cookie(response, bundle)
    return response


@router.post("/refresh", summary="Refresh access token")
async def refresh_token(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    refresh_token_value = request.cookies.get("refresh_token")
    if not refresh_token_value:
        body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
        refresh_token_value = body.get("refresh_token")
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refresh token missing")
    auth_service = AuthService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    bundle = await auth_service.refresh_tokens(
        refresh_token_value,
        source_ip=client_ip,
        user_agent=user_agent,
    )
    await session.commit()
    response = JSONResponse(
        {
            "access_token": bundle.access_token,
            "token_type": bundle.token_type,
            "expires_at": bundle.access_expires_at.isoformat(),
        }
    )
    _set_refresh_cookie(response, bundle)
    return response


@router.post("/logout", summary="Logout current session")
async def logout(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    refresh_token_value = request.cookies.get("refresh_token")
    user_service = UserService(session)
    actor_user = None
    if refresh_token_value:
        try:
            payload = decode_token(refresh_token_value, verify_exp=False)
            user_id = payload.get("sub")
            if user_id:
                actor_user = await user_service.get_by_id(user_id)
        except TokenError:
            actor_user = None
        auth_service = AuthService(session)
        await auth_service.revoke_refresh_token(refresh_token_value)
        await session.commit()
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    if actor_user:
        await user_service.audit(
            user=actor_user,
            actor=actor_user,
            event="auth.logout",
            source_ip=client_ip,
            user_agent=user_agent,
        )
        await session.commit()
    response = JSONResponse({"detail": "Logged out"})
    response.delete_cookie("refresh_token", path="/auth/refresh", domain=settings.auth_cookie_domain)
    return response


@router.get("/me", summary="Current user profile")
async def get_profile(user=Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email,
        "roles": [role.slug for role in user.roles],
        "is_superuser": user.is_superuser,
    }
