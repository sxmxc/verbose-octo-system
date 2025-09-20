# Authentication Providers

This guide explains how to configure OpenID Connect (OIDC), LDAP, and Active Directory providers with HashiCorp Vault-backed secrets so administrators can deliver plug-and-play single sign-on.

## Configuration Sources

The backend loads provider definitions in priority order:

1. Objects provided directly to `settings.auth_providers` (rare).
2. JSON from the `AUTH_PROVIDERS_JSON` environment variable.
3. A JSON file referenced by `AUTH_PROVIDERS_FILE` (recommended for production).
4. Runtime updates made through **Administration → Auth settings** in the UI.

The first non-empty source wins. To keep things declarative, copy `config/auth-providers.example.json` to `config/auth-providers.json`, adjust the entries, and set `AUTH_PROVIDERS_FILE=./config/auth-providers.json` in `.env`. Docker Compose mounts the `./config` directory into the API and worker containers.

## Vault-backed Secrets

Provider definitions accept Vault references instead of inline credentials. Each supported secret field has a twin with a `_vault` suffix. Example:

```json
{
  "client_secret_vault": {
    "mount": "sre",
    "path": "auth/okta",
    "key": "client_secret",
    "engine": "kv-v2",
    "version": 2
  }
}
```

Field reference:

- `mount` (optional) – Vault mount point. Defaults to `VAULT_KV_MOUNT` when omitted.
- `path` – Secret path under the mount (without `data/`).
- `key` – Field inside the secret payload to read.
- `engine` – Either `kv-v2` (default) or `kv-v1`.
- `version` – Optional version for KV v2 reads.

Enable Vault lookups by configuring the environment variables documented in `.env.example` (`VAULT_ADDR`, `VAULT_TOKEN` or `VAULT_TOKEN_FILE`, `VAULT_KV_MOUNT`, etc.). At startup the backend resolves the reference, converts it into a `SecretStr`, and keeps raw credentials out of JSON files and API responses.

## OIDC Quick Start

1. **Create an OIDC application** with your identity provider (Okta, Azure AD, Google Workspace, Ping, etc.). Include `https://<toolbox-host>/auth/sso/<provider-name>/callback` and, for local development, `http://localhost:5173/auth/sso/<provider-name>/callback` as redirect URIs.
2. **Store the client secret** in Vault:
   ```bash
   vault kv put sre/auth/okta client_secret="<client-secret>"
   ```
   You can include other metadata (client ID, tenant) in the same payload for convenience.
3. **Add the provider** to `config/auth-providers.json`:
   ```json
   {
     "name": "okta",
     "type": "oidc",
     "display_name": "Okta",
     "discovery_url": "https://YOUR_OKTA_DOMAIN/.well-known/openid-configuration",
     "client_id": "<client-id>",
     "client_secret_vault": {
       "mount": "sre",
       "path": "auth/okta",
       "key": "client_secret"
     },
     "redirect_base_url": "http://localhost:5173",
     "scopes": ["openid", "profile", "email"],
     "group_claim": "groups",
     "role_mappings": {
       "sre-admins": ["system.admin"],
       "sre-operators": ["toolkit.curator"]
     }
   }
   ```
4. **Restart the API** (or toggle any provider in the admin UI). A login button labelled "Okta" appears on the welcome screen once the provider is enabled.

### Additional OIDC tips

- Leave `use_pkce` enabled unless the identity provider requires the *client_secret_basic* auth method.
- Use `claim_mappings` to map non-standard claim names (for example: `{ "username": "preferred_username" }`).
- Combine `group_claim` and `role_mappings` to translate IdP groups into Toolbox roles.

## LDAP & Active Directory Quick Start

1. **Provision a bind account** with read access to user and (optionally) group containers.
2. **Store bind credentials** in Vault:
   ```bash
   vault kv put sre/auth/ldap bind_password="<password>"
   vault kv put sre/auth/ad bind_password="<password>"
   ```
3. **Define providers** in your configuration file. Generic LDAP example:
   ```json
   {
     "name": "corp-ldap",
     "type": "ldap",
     "display_name": "Corporate LDAP",
     "server_uri": "ldaps://ldap.example.com",
     "bind_dn": "cn=service,ou=system,dc=example,dc=com",
     "bind_password_vault": {
       "mount": "sre",
       "path": "auth/ldap",
       "key": "bind_password"
     },
     "user_search_base": "ou=people,dc=example,dc=com",
     "user_filter": "(&(objectClass=person)(uid={username}))",
     "group_search_base": "ou=groups,dc=example,dc=com",
     "group_filter": "(&(objectClass=groupOfNames)(member={user_dn}))",
     "role_mappings": {
       "cn=sre-admins,ou=groups,dc=example,dc=com": ["system.admin"]
     }
   }
   ```
   Active Directory only needs `"type": "active_directory"`, a `default_domain`, and optionally AD-specific attribute overrides. `config/auth-providers.example.json` shows a starter template.
4. **TLS considerations** – prefer LDAPS. If the directory uses a private CA, add the certificate bundle to the container and reference it via `REQUESTS_CA_BUNDLE` or system trust store. Vault itself can use `VAULT_CA_CERT` for custom roots.
5. **Test connectivity** from **Administration → Auth settings → Test connection** after saving changes.

## Operational Checklist

- [ ] Vault initialised, unsealed, and reachable at `VAULT_ADDR`.
- [ ] Short-lived tokens or AppRole credentials available to the API/worker containers.
- [ ] `AUTH_PROVIDERS_FILE` points at the intended JSON configuration and the file is mounted into the container.
- [ ] Required secrets exist under the configured mount (default `sre`) using the KV v2 engine.
- [ ] Login flow verified for each enabled provider (Okta/Azure AD/LDAP/AD, etc.).

See `docs/project-setup.md` for Vault bootstrap commands and `TODO.md` for remaining hardening tasks.
