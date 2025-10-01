from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import AnyHttpUrl, BaseModel, Field, HttpUrl, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .secrets import VaultSecretRef

DEFAULT_JWT_SECRET = "change-me"
BANNED_JWT_SECRETS = {DEFAULT_JWT_SECRET, "insecure-development-secret-change-me"}
MIN_JWT_SECRET_LENGTH = 32


class AuthProviderBase(BaseModel):
    name: str
    type: str
    display_name: Optional[str] = None
    enabled: bool = True
    default_roles: List[str] = Field(default_factory=list)

    @property
    def effective_display_name(self) -> str:
        return self.display_name or self.name.title()


class LocalAuthProvider(AuthProviderBase):
    type: Literal["local"] = "local"
    allow_registration: bool = False
    max_attempts: int = Field(
        default=5,
        ge=0,
        description="Maximum failed login attempts before the account is locked. Set to 0 to disable throttling.",
    )
    window_seconds: int = Field(
        default=300,
        ge=0,
        description="Sliding window in seconds for counting failed attempts. Set to 0 to disable throttling.",
    )
    lockout_seconds: int = Field(
        default=900,
        ge=0,
        description="Lockout duration in seconds once the failed attempt threshold is reached. Set to 0 to disable throttling.",
    )


class OidcAuthProvider(AuthProviderBase):
    type: Literal["oidc"] = "oidc"
    discovery_url: HttpUrl
    client_id: str
    client_secret: Optional[SecretStr] = None
    client_secret_vault: Optional[VaultSecretRef] = None
    redirect_base_url: Optional[HttpUrl] = None
    scopes: List[str] = Field(default_factory=lambda: ["openid", "profile", "email"])
    prompt: Optional[str] = None
    response_type: str = "code"
    audience: Optional[str] = None
    claim_mappings: Dict[str, str] = Field(default_factory=dict)
    group_claim: Optional[str] = None
    role_mappings: Dict[str, List[str]] = Field(default_factory=dict)
    use_pkce: bool = True

    @model_validator(mode="after")
    def _ensure_secret(self) -> "OidcAuthProvider":
        if not self.enabled:
            return self
        if not self.client_secret and not self.client_secret_vault:
            raise ValueError("OIDC provider requires client_secret or client_secret_vault")
        return self


class LdapAuthProvider(AuthProviderBase):
    type: Literal["ldap"] = "ldap"
    server_uri: str
    bind_dn: Optional[str] = None
    bind_password: Optional[SecretStr] = None
    bind_password_vault: Optional[VaultSecretRef] = None
    user_dn_template: Optional[str] = None
    user_search_base: Optional[str] = None
    user_filter: Optional[str] = None
    start_tls: bool = True
    attributes: Dict[str, str] = Field(default_factory=lambda: {
        "username": "uid",
        "email": "mail",
        "display_name": "cn",
    })
    group_search_base: Optional[str] = None
    group_filter: Optional[str] = None
    group_member_attr: str = "memberOf"
    role_mappings: Dict[str, List[str]] = Field(default_factory=dict)


class ActiveDirectoryAuthProvider(LdapAuthProvider):
    type: Literal["active_directory"] = "active_directory"
    default_domain: Optional[str] = None
    attributes: Dict[str, str] = Field(default_factory=lambda: {
        "username": "sAMAccountName",
        "email": "mail",
        "display_name": "displayName",
    })


AuthProviderConfig = Union[
    LocalAuthProvider,
    OidcAuthProvider,
    LdapAuthProvider,
    ActiveDirectoryAuthProvider,
]


def default_cors_origins() -> List[str]:
    # Allow common local dev frontends by default; override via FRONTEND_BASE_URL or CORS_ORIGINS
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    app_name: str = "SRE Toolbox"
    app_env: str = "dev"
    log_level: str = "INFO"

    zbx_base_url: AnyHttpUrl | None = None
    zbx_token: str | None = None

    redis_url: str = Field(default="redis://redis:6379/0")
    redis_prefix: str = Field(default="sretoolbox")
    frontend_base_url: AnyHttpUrl | None = Field(default=None)
    cors_origins: List[str] = Field(default_factory=default_cors_origins)
    toolkit_storage_dir: Path = Field(default=Path("./data/toolkits"))
    toolkit_catalog_url: Optional[AnyHttpUrl] = Field(
        default="https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json",
        description="Community toolkit catalog manifest URL",
    )
    toolkit_upload_max_bytes: int = Field(default=50 * 1024 * 1024)
    toolkit_bundle_max_bytes: int = Field(default=200 * 1024 * 1024)
    toolkit_bundle_max_file_bytes: int = Field(default=100 * 1024 * 1024)
    database_url: str = Field(default="sqlite+aiosqlite:///./data/app.db")
    audit_log_retention_days: int = Field(default=90, ge=1, description="Number of days to retain audit log entries")

    auth_jwt_secret: SecretStr = Field(default=SecretStr("change-me"), repr=False)
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_public_key: Optional[SecretStr] = Field(default=None, repr=False)
    auth_jwt_private_key: Optional[SecretStr] = Field(default=None, repr=False)
    auth_access_token_ttl_seconds: int = 900
    auth_refresh_token_ttl_seconds: int = 14 * 24 * 60 * 60
    auth_token_issuer: str = "sre-toolbox"
    auth_cookie_domain: Optional[str] = None
    auth_cookie_secure: bool = True
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_state_secret: Optional[SecretStr] = None
    auth_sso_state_ttl_seconds: int = 600

    vault_addr: Optional[AnyHttpUrl] = None
    vault_token: Optional[SecretStr] = Field(default=None, repr=False)
    vault_token_file: Optional[Path] = None
    vault_namespace: Optional[str] = None
    vault_kv_mount: str = "secret"
    vault_tls_skip_verify: bool = False
    vault_ca_cert: Optional[Path] = None
    vault_auth_method: Literal["token", "approle"] = "token"
    vault_approle_role_id: Optional[SecretStr] = Field(default=None, repr=False)
    vault_approle_secret_id: Optional[SecretStr] = Field(default=None, repr=False)

    auth_providers: List[AuthProviderConfig] = Field(default_factory=list)
    auth_providers_json: Optional[str] = None
    auth_providers_file: Optional[Path] = None

    bootstrap_admin_username: Optional[str] = None
    bootstrap_admin_password: Optional[SecretStr] = Field(default=None, repr=False)
    bootstrap_admin_email: Optional[str] = None

    @staticmethod
    def _normalize_origin(value: str) -> str:
        value = value.strip()
        if not value or value == "*":
            return value
        if "://" not in value:
            return value
        parts = urlsplit(value)
        if not parts.scheme or not parts.netloc:
            return value
        return urlunsplit((parts.scheme, parts.netloc, "", "", ""))

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            items = [cls._normalize_origin(s) for s in v.split(",")]
        elif isinstance(v, list):
            items = [cls._normalize_origin(str(item)) for item in v]
        else:
            return v
        return [item for item in dict.fromkeys(items) if item]

    @model_validator(mode="after")
    def ensure_cors(cls, settings: "Settings") -> "Settings":
        normalized = [cls._normalize_origin(origin) for origin in settings.cors_origins]
        normalized = [origin for origin in normalized if origin]
        if settings.frontend_base_url:
            frontend_origin = cls._normalize_origin(str(settings.frontend_base_url))
            if frontend_origin:
                normalized.append(frontend_origin)
        settings.cors_origins = list(dict.fromkeys(normalized))
        settings.auth_providers = cls._build_auth_providers(settings)
        cls._validate_jwt_settings(settings)
        return settings

    @classmethod
    def _build_auth_providers(cls, settings: "Settings") -> List[AuthProviderConfig]:
        providers: List[AuthProviderConfig] = []
        raw_items: List[Any] = []
        if settings.auth_providers:
            raw_items.extend(settings.auth_providers)
        if settings.auth_providers_json:
            try:
                raw_items.extend(json.loads(settings.auth_providers_json))
            except json.JSONDecodeError as exc:  # pragma: no cover - configuration phase
                raise ValueError(f"Invalid AUTH_PROVIDERS_JSON: {exc}") from exc
        if settings.auth_providers_file:
            try:
                data = settings.auth_providers_file.read_text(encoding="utf-8")
                raw_items.extend(json.loads(data))
            except FileNotFoundError as exc:  # pragma: no cover - configuration phase
                raise ValueError(f"Auth providers file not found: {settings.auth_providers_file}") from exc
            except json.JSONDecodeError as exc:  # pragma: no cover - configuration phase
                raise ValueError(f"Invalid auth providers file JSON: {exc}") from exc

        if not raw_items:
            raw_items.append({"name": "local", "type": "local", "display_name": "Local"})

        for item in raw_items:
            if isinstance(item, AuthProviderBase):
                providers.append(item)  # Already validated
                continue
            if not isinstance(item, dict):
                raise ValueError("Auth provider definitions must be dicts or AuthProviderBase instances")
            provider_type = item.get("type", "local").lower()
            provider_cls_map = {
                "local": LocalAuthProvider,
                "oidc": OidcAuthProvider,
                "ldap": LdapAuthProvider,
                "active_directory": ActiveDirectoryAuthProvider,
            }
            provider_cls = provider_cls_map.get(provider_type)
            if not provider_cls:
                raise ValueError(f"Unsupported auth provider type: {provider_type}")
            item = cls._resolve_provider_secrets(settings, item, provider_type)
            try:
                providers.append(provider_cls(**item))
            except ValidationError as exc:  # pragma: no cover - configuration phase
                raise ValueError(f"Invalid configuration for provider {item.get('name')}: {exc}") from exc
        return providers

    @classmethod
    def _validate_jwt_settings(cls, settings: "Settings") -> None:
        algorithm = settings.auth_jwt_algorithm.upper()
        if algorithm.startswith(("RS", "ES")):
            private_key = (
                settings.auth_jwt_private_key.get_secret_value()
                if settings.auth_jwt_private_key
                else ""
            )
            public_key = (
                settings.auth_jwt_public_key.get_secret_value()
                if settings.auth_jwt_public_key
                else ""
            )

            private_candidate = private_key.strip()
            public_candidate = public_key.strip()

            if not private_candidate or not public_candidate:
                raise ValueError(
                    "AUTH_JWT_PRIVATE_KEY and AUTH_JWT_PUBLIC_KEY are required when AUTH_JWT_ALGORITHM uses asymmetric signing."
                )
            if private_candidate != private_key or public_candidate != public_key:
                raise ValueError(
                    "AUTH_JWT_PRIVATE_KEY and AUTH_JWT_PUBLIC_KEY must not include leading or trailing whitespace."
                )
            return

        secret_value = ""
        if settings.auth_jwt_secret:
            secret_value = settings.auth_jwt_secret.get_secret_value()

        candidate = secret_value.strip()
        if not candidate:
            raise ValueError("AUTH_JWT_SECRET must be set to a non-empty value.")
        if candidate.lower() in BANNED_JWT_SECRETS:
            raise ValueError("AUTH_JWT_SECRET must be changed from the sample value in .env.example.")
        if len(candidate) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"AUTH_JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters long; run `openssl rand -hex 32` to generate one."
            )
        if candidate != secret_value:
            raise ValueError("AUTH_JWT_SECRET must not include leading or trailing whitespace.")

    @classmethod
    def _resolve_provider_secrets(
        cls,
        settings: "Settings",
        raw_item: Dict[str, Any],
        provider_type: str,
    ) -> Dict[str, Any]:
        secret_fields = {
            "oidc": [("client_secret", "client_secret_vault")],
            "ldap": [("bind_password", "bind_password_vault")],
            "active_directory": [("bind_password", "bind_password_vault")],
        }
        mappings = secret_fields.get(provider_type, [])
        if not mappings:
            return raw_item
        if not raw_item.get("enabled", True):
            return raw_item
        resolved = dict(raw_item)
        for field_name, vault_field in mappings:
            if vault_field not in resolved:
                continue
            try:
                ref = VaultSecretRef.model_validate(resolved[vault_field])
            except ValidationError as exc:
                raise ValueError(
                    f"Invalid Vault reference for provider {raw_item.get('name') or raw_item.get('type')}: {exc}"
                ) from exc
            resolved[vault_field] = ref
            if resolved.get(field_name):
                continue
            try:
                from .secrets.vault import read_vault_secret

                secret_value = read_vault_secret(settings, ref)
            except RuntimeError as exc:
                raise ValueError(
                    f"Failed to resolve secret for provider {raw_item.get('name')}: {exc}"
                ) from exc
            resolved[field_name] = SecretStr(secret_value)
        return resolved

settings = Settings()
