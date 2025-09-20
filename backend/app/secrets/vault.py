from __future__ import annotations

from typing import TYPE_CHECKING

import hvac
from hvac.exceptions import InvalidPath, VaultError

from .models import VaultSecretRef

if TYPE_CHECKING:  # pragma: no cover - type hints only
    from ..config import Settings


def _resolve_verify(settings: "Settings") -> bool | str:
    if settings.vault_tls_skip_verify:
        return False
    if settings.vault_ca_cert:
        return str(settings.vault_ca_cert)
    return True


def _load_token(settings: "Settings") -> str | None:
    if settings.vault_token:
        token = settings.vault_token.get_secret_value()
        if token:
            return token.strip()
    if settings.vault_token_file:
        try:
            token = settings.vault_token_file.read_text(encoding="utf-8").strip()
            if token:
                return token
        except FileNotFoundError as exc:
            raise RuntimeError(f"Vault token file not found: {settings.vault_token_file}") from exc
    return None


def _ensure_authenticated(client: hvac.Client, settings: "Settings") -> None:
    if settings.vault_auth_method == "approle":
        role_id = settings.vault_approle_role_id.get_secret_value() if settings.vault_approle_role_id else None
        secret_id = settings.vault_approle_secret_id.get_secret_value() if settings.vault_approle_secret_id else None
        if not role_id or not secret_id:
            raise RuntimeError("VAULT_AUTH_METHOD=approle requires VAULT_APPROLE_ROLE_ID and VAULT_APPROLE_SECRET_ID")
        client.auth.approle.login(role_id=role_id, secret_id=secret_id)
    if not client.is_authenticated():
        raise RuntimeError("Vault authentication failed. Check VAULT_TOKEN or AppRole credentials.")


def get_vault_client(settings: "Settings") -> hvac.Client:
    client = getattr(settings, "_vault_client", None)
    if client:
        return client
    if not settings.vault_addr:
        raise RuntimeError("VAULT_ADDR must be configured to resolve Vault secrets.")
    token = _load_token(settings)
    if settings.vault_auth_method == "token" and not token:
        raise RuntimeError("VAULT_TOKEN or VAULT_TOKEN_FILE must be set when VAULT_AUTH_METHOD=token.")
    client = hvac.Client(
        url=str(settings.vault_addr),
        token=token,
        namespace=settings.vault_namespace,
        verify=_resolve_verify(settings),
    )
    _ensure_authenticated(client, settings)
    setattr(settings, "_vault_client", client)
    return client


def read_vault_secret(settings: "Settings", ref: VaultSecretRef) -> str:
    client = get_vault_client(settings)
    mount = ref.mount or settings.vault_kv_mount
    if not mount:
        raise RuntimeError("Vault mount is not configured. Set VAULT_KV_MOUNT or specify mount in client configuration.")
    try:
        if ref.engine == "kv-v2":
            payload = client.secrets.kv.v2.read_secret_version(
                mount_point=mount,
                path=ref.path,
                version=ref.version,
            )
            data = payload.get("data", {}).get("data", {})
        else:
            payload = client.secrets.kv.v1.read_secret(
                mount_point=mount,
                path=ref.path,
            )
            data = payload.get("data", {})
    except InvalidPath as exc:
        raise RuntimeError(f"Vault secret not found at mount '{mount}' path '{ref.path}'") from exc
    except VaultError as exc:
        raise RuntimeError(f"Vault error while reading '{mount}/{ref.path}': {exc}") from exc
    value = data.get(ref.key)
    if value is None:
        raise RuntimeError(
            f"Vault secret '{mount}/{ref.path}' does not contain key '{ref.key}'."
        )
    return str(value)
