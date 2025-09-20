from __future__ import annotations

import json
from typing import Dict, Iterable, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import (
    ActiveDirectoryAuthProvider as ActiveDirectoryConfig,
    AuthProviderConfig as AuthProviderSettings,
    LdapAuthProvider as LdapConfig,
    LocalAuthProvider as LocalConfig,
    OidcAuthProvider as OidcConfig,
    settings,
)
from ..models.auth_provider import AuthProviderConfig
from .providers.base import AuthProvider
from .providers.ldap import ActiveDirectoryAuthProvider, LdapAuthProvider
from .providers.local import LocalAuthProvider
from .providers.oidc import OidcAuthProvider


_PROVIDER_FACTORIES: Dict[str, type[AuthProvider]] = {
    "local": LocalAuthProvider,
    "oidc": OidcAuthProvider,
    "ldap": LdapAuthProvider,
    "active_directory": ActiveDirectoryAuthProvider,
}

_CONFIG_MODELS = {
    "local": LocalConfig,
    "oidc": OidcConfig,
    "ldap": LdapConfig,
    "active_directory": ActiveDirectoryConfig,
}

_PROVIDERS: Dict[str, AuthProvider] = {}


def register_provider(name: str, provider_cls: type[AuthProvider]) -> None:
    _PROVIDER_FACTORIES[name] = provider_cls


def _instantiate_provider(config_obj: AuthProviderSettings | dict) -> AuthProvider | None:
    if isinstance(config_obj, AuthProviderSettings):
        provider_type = config_obj.type
        payload = config_obj.model_dump()
    else:
        payload = dict(config_obj)
        provider_type = payload.get("type")
        if provider_type:
            payload = settings.__class__._resolve_provider_secrets(settings, payload, provider_type)
    if not provider_type:
        return None
    factory = _PROVIDER_FACTORIES.get(provider_type)
    if not factory:
        return None
    config_cls = getattr(factory, "config_model", None) or _CONFIG_MODELS.get(provider_type)
    if config_cls and not isinstance(config_obj, config_cls):
        config_obj = config_cls(**payload)
    provider = factory(config_obj)  # type: ignore[arg-type]
    return provider if provider.enabled else None


async def load_providers(session: AsyncSession | None = None) -> None:
    global _PROVIDERS
    instances: List[AuthProvider] = []
    for config in settings.auth_providers:
        provider = _instantiate_provider(config)
        if provider:
            instances.append(provider)
    if session is not None:
        stmt = select(AuthProviderConfig).where(AuthProviderConfig.enabled.is_(True))
        result = await session.execute(stmt)
        for record in result.scalars():
            try:
                raw = json.loads(record.config)
            except json.JSONDecodeError:  # pragma: no cover - defensive log path
                continue
            raw.setdefault("name", record.name)
            raw.setdefault("type", record.type)
            provider = _instantiate_provider(raw)
            if provider:
                instances.append(provider)
    _PROVIDERS = {provider.name: provider for provider in instances}


def get_provider(name: str) -> AuthProvider | None:
    return _PROVIDERS.get(name)


def list_provider_metadata(providers: Iterable[AuthProvider] | None = None) -> List[dict]:
    source = providers if providers is not None else _PROVIDERS.values()
    return [provider.get_login_metadata() for provider in source if provider.enabled]
