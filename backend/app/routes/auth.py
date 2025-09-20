from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, JSONResponse
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


@router.get("/providers/{provider_name}/callback", summary="Complete SSO callback")
async def provider_callback(
    provider_name: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Response:
    provider = get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    state_data: Dict[str, Any] | None = None
    user, bundle, payload = await _complete_provider_login(provider, request, session)
    response: Response
    # Attempt to recover state context for SPA popup handling.
    state_token = request.query_params.get("state")
    if state_token:
        try:
            state_data = verify_state(state_token, max_age=settings.auth_sso_state_ttl_seconds)
        except ValueError:
            state_data = None
    if state_data and state_data.get("mode") == "popup":
        from urllib.parse import urlparse
        import json as _json

        next_hint = state_data.get("next") or str(settings.frontend_base_url or request.base_url)
        parsed = urlparse(next_hint)
        target_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme else next_hint
        message = {
            "type": "sre-toolbox:auth",
            "payload": payload,
        }
        script = f"""
        <!DOCTYPE html>
        <html lang=\"en\">
        <head>
          <meta charset=\"utf-8\" />
          <title>Authentication Complete</title>
        </head>
        <body>
          <script>
            (function () {{
              var message = { _json.dumps(message) };
              var targetOrigin = { _json.dumps(target_origin) };
              if (window.opener && !window.opener.closed) {{
                window.opener.postMessage(message, targetOrigin);
                window.close();
              }} else {{
                window.location.assign(targetOrigin || '/');
              }}
            }})();
          </script>
        </body>
        </html>
        """
        response = HTMLResponse(content=script)
    else:
        response = JSONResponse(payload)
    _set_refresh_cookie(response, bundle)
    return response


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
