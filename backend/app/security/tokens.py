from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt
from fastapi import HTTPException, status

from ..config import settings


@dataclass
class TokenBundle:
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    session_id: str
    token_type: str = "bearer"


class TokenError(HTTPException):
    def __init__(self, detail: str = "Invalid authentication token") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _signing_key(use_private: bool) -> str:
    algorithm = settings.auth_jwt_algorithm.upper()
    if algorithm.startswith("RS") or algorithm.startswith("ES"):
        key = settings.auth_jwt_private_key if use_private else settings.auth_jwt_public_key
        if key is None:
            raise ValueError("JWT keypair not configured for asymmetric algorithm")
        return key.get_secret_value()
    secret = settings.auth_jwt_secret
    if secret is None:
        raise ValueError("JWT secret not configured")
    return secret.get_secret_value()


def _encode(payload: Dict[str, Any], expires_delta: timedelta, token_type: str, kid: str | None = None) -> tuple[str, datetime]:
    issued_at = _now()
    expires_at = issued_at + expires_delta
    token_id = payload.get("jti") or str(uuid.uuid4())
    claims = {
        **payload,
        "iss": settings.auth_token_issuer,
        "iat": int(issued_at.timestamp()),
        "nbf": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": token_id,
        "typ": token_type,
    }
    headers: Dict[str, Any] = {}
    if kid:
        headers["kid"] = kid
    token = jwt.encode(claims, _signing_key(use_private=True), algorithm=settings.auth_jwt_algorithm, headers=headers)
    return token, expires_at


def _decode(token: str, verify_exp: bool = True) -> Dict[str, Any]:
    try:
        return jwt.decode(
            token,
            key=_signing_key(use_private=False),
            algorithms=[settings.auth_jwt_algorithm],
            options={
                "verify_exp": verify_exp,
                "verify_aud": False,
            },
            issuer=settings.auth_token_issuer,
        )
    except jwt.ExpiredSignatureError as exc:  # pragma: no cover - runtime validation
        raise TokenError("Token expired") from exc
    except jwt.PyJWTError as exc:  # pragma: no cover - runtime validation
        raise TokenError("Token validation failed") from exc


def create_token_bundle(
    user_id: str,
    roles: list[str],
    identity_provider: str,
    session_id: str,
    extra_claims: Dict[str, Any] | None = None,
) -> TokenBundle:
    payload_base = {
        "sub": user_id,
        "roles": roles,
        "sid": session_id,
        "provider": identity_provider,
    }
    if extra_claims:
        payload_base.update(extra_claims)

    access_token, access_expires_at = _encode(
        payload_base,
        timedelta(seconds=settings.auth_access_token_ttl_seconds),
        token_type="access",
    )
    refresh_payload = {
        **payload_base,
        "token_use": "refresh",
    }
    refresh_token, refresh_expires_at = _encode(
        refresh_payload,
        timedelta(seconds=settings.auth_refresh_token_ttl_seconds),
        token_type="refresh",
    )
    return TokenBundle(
        access_token=access_token,
        access_expires_at=access_expires_at,
        refresh_token=refresh_token,
        refresh_expires_at=refresh_expires_at,
        session_id=session_id,
    )


def decode_token(token: str, verify_exp: bool = True) -> Dict[str, Any]:
    return _decode(token, verify_exp=verify_exp)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_token_expired(expires_at: datetime) -> bool:
    return expires_at <= _now()
