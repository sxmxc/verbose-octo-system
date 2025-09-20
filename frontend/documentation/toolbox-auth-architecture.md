# Toolbox Authentication and Authorization Architecture

The SRE Toolbox ships with a modular authentication stack that supports local logins and enterprise single sign-on out of the box. This document explains how the pieces fit together so operators can deploy the platform securely and extend it when new identity providers are required.

## Objectives

- Provide secure local username/password accounts with strong password hashing.
- Support pluggable single sign-on (SSO) providers including OpenID Connect, LDAP, and Active Directory without code changes.
- Centralise identity data in the Toolbox database for auditing, revocation, and role assignment.
- Issue short-lived access tokens and refresh tokens that can be rotated or revoked.
- Enforce role-based access control (RBAC) consistently across the API and web shell.
- Keep the deployment path simple for both local development (SQLite) and production (PostgreSQL).

## Core components

### Database layer

- SQLAlchemy 2.0 models back the authentication system and run on PostgreSQL by default (via Docker Compose) or SQLite in local development.
- Tables include `users`, `roles`, `user_roles`, `sso_identities`, `auth_sessions`, `auth_provider_configs`, and `audit_logs`.
- Alembic migrations ship with the repository; Docker Compose runs `alembic upgrade head` automatically, and `init_db()` creates tables when running the API manually.

### Security utilities

- Passwords are hashed with `passlib`'s `CryptContext` (bcrypt by default).
- JWTs are issued with `PyJWT`. Supply `AUTH_JWT_SECRET` for symmetric signing or an `AUTH_JWT_PRIVATE_KEY`/`AUTH_JWT_PUBLIC_KEY` pair for asymmetric signing.
- `AuthSession` records persist refresh-token hashes, client metadata, and revocation timestamps.
- Signed SSO state/nonce payloads use `AUTH_STATE_SECRET` (or fall back to `AUTH_JWT_SECRET`) and expire according to `AUTH_SSO_STATE_TTL_SECONDS`.

### Provider registry and configuration

- Providers are declared through `settings.auth_providers` and can be bootstrapped via `AUTH_PROVIDERS_JSON` or `AUTH_PROVIDERS_FILE`.
- Runtime edits are stored in the `auth_provider_configs` table and are exposed through **Administration → Auth settings**. Performing these actions requires the `system.admin` role.
- The `ProviderConfigService` persists provider definitions, reloads the registry, and immediately activates new or updated providers without a restart.

### Provider types

- **Local** – Username/password accounts backed by the Toolbox database. Supports optional self-registration (`allow_registration`) and works well for lab environments.
- **OpenID Connect** – Integrates with providers such as Keycloak, Okta, and Azure AD. Configure discovery, client credentials, scopes, optional PKCE, audience validation, and claim/role mappings.
- **LDAP** – Authenticates against generic LDAP directories. Supports bind DN credentials, user search templates, attribute mapping, and group-to-role translation via `role_mappings`.
- **Active Directory** – Extends the LDAP provider with sensible attribute defaults and optional `default_domain` handling so users can authenticate with either a DN or UPN.

### API surface

- `GET /auth/providers` – Enumerate enabled providers and their display metadata.
- `POST /auth/login/{provider}` – Handle local/LDAP credential submission and issue tokens.
- `GET /auth/providers/{provider}/begin` and `POST /auth/providers/{provider}/callback` – Support OIDC redirect flows.
- `POST /auth/refresh` – Rotate refresh tokens, issue a new access token, and persist session metadata.
- `POST /auth/logout` – Revoke the active refresh token.
- `GET /auth/me` – Return the authenticated user's profile and roles.
- Administrative endpoints under `/admin/users` and `/admin/settings/providers` require `system.admin` and expose user management and provider configuration respectively.

### Tokens and sessions

- Access tokens default to 15 minutes (`AUTH_ACCESS_TOKEN_TTL_SECONDS`); refresh tokens default to 14 days (`AUTH_REFRESH_TOKEN_TTL_SECONDS`). Adjust both to match your organisational policies.
- Refresh tokens are stored as bcrypt hashes in `auth_sessions`. Each refresh response rotates the token identifier and invalidates the previous token to prevent replay.
- Browser clients receive refresh tokens as httpOnly cookies. Tune `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, and `AUTH_COOKIE_DOMAIN` to align with your deployment topology.
- API clients can supply refresh tokens via the `Authorization` header when cookies are not practical.

### Role enforcement

- Default roles include `toolkit.user` (operate toolkits), `toolkit.curator` (enable/disable toolkits), and `system.admin` (full administrative access).
- FastAPI dependencies such as `require_roles` guard dashboard, job, toolkit, and admin routes. The frontend mirrors these checks to hide UI controls from unauthorised accounts.
- During startup, `ensure_core_roles` seeds these roles and `bootstrap_admin_user` can create a privileged account when `.env` provides `BOOTSTRAP_ADMIN_*` values.

### Operations checklist

1. Configure `AUTH_JWT_SECRET` (or upload signing keys) before exposing the Toolbox publicly.
2. Set `FRONTEND_BASE_URL` so CORS origins match the deployed frontend and review cookie attributes for secure/production usage.
3. Bootstrap an admin account via `BOOTSTRAP_ADMIN_*` or create one manually, then assign curator/system roles as needed.
4. Add SSO providers either via environment variables at deploy time or through **Administration → Auth settings** once the platform is running.
5. Periodically audit `auth_sessions` and `audit_logs` to ensure refresh tokens are rotated and administrative actions are tracked.

## Security considerations

- Enforce HTTPS in production so cookies (`Secure` + `SameSite`) remain protected in transit.
- Validate redirect URIs on your identity provider to point back to the Toolbox callback routes.
- Restrict who receives the `system.admin` role; toolkit installation and auth configuration both depend on it.
- Monitor login failures and consider enabling network-level rate limiting while Redis-backed throttling is under evaluation.
- Keep provider secrets (client secrets, bind passwords) in a dedicated secrets manager and reference them via environment variables at runtime.

## Future enhancements

- Redis-backed login throttling and lockouts for local/LDAP providers.
- Optional enforcement that JWT secrets/keys must be overridden in production builds.
- Expanded audit logging around provider configuration changes and session revocations.
