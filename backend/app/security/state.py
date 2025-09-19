from __future__ import annotations

from typing import Any, Dict

from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

from ..config import settings

_STATE_SALT = "sre-toolbox.sso.state"


def _serializer() -> URLSafeTimedSerializer:
    secret = settings.auth_state_secret or settings.auth_jwt_secret
    if secret is None:
        raise RuntimeError("State signing secret not configured")
    return URLSafeTimedSerializer(secret.get_secret_value(), salt=_STATE_SALT)


def sign_state(data: Dict[str, Any]) -> str:
    return _serializer().dumps(data)


def verify_state(token: str, max_age: int | None = None) -> Dict[str, Any]:
    serializer = _serializer()
    try:
        return serializer.loads(token, max_age=max_age or settings.auth_sso_state_ttl_seconds)
    except (BadSignature, BadTimeSignature) as exc:  # pragma: no cover - runtime validation
        raise ValueError("Invalid SSO state token") from exc
