from pydantic import SecretStr

from backend.app.security import registry


def test_instantiate_provider_resolves_vault_secret(monkeypatch):
    calls = {}

    def fake_resolver(cls, settings_obj, raw_item, provider_type):  # pragma: no cover - monkeypatched for test
        calls["provider_type"] = provider_type
        updated = dict(raw_item)
        updated["client_secret"] = SecretStr("vault-secret")
        return updated

    monkeypatch.setattr(
        registry.settings.__class__,
        "_resolve_provider_secrets",
        classmethod(fake_resolver),
        raising=True,
    )

    provider = registry._instantiate_provider(
        {
            "name": "keycloak",
            "type": "oidc",
            "enabled": True,
            "discovery_url": "https://auth.example.com/.well-known/openid-configuration",
            "client_id": "sre-toolbox",
            "client_secret_vault": {"path": "auth/keycloak", "key": "client_secret"},
            "redirect_base_url": "https://app.example.com",
            "scopes": ["openid", "profile"],
        }
    )

    assert calls["provider_type"] == "oidc"
    assert provider is not None
    assert provider.config.client_secret and provider.config.client_secret.get_secret_value() == "vault-secret"

