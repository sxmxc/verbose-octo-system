# Toolbox Authentication and Authorization Architecture

## Objectives
- Support local username/password accounts with secure password hashing.
- Allow pluggable single sign-on (SSO) providers including OpenID Connect (Keycloak), LDAP, and Active Directory.
- Centralize identity data in an application database to support auditing and future features (RBAC, API tokens).
- Provide stateless access tokens for API usage, refresh tokens for session renewal, and short-lived authorization codes for SSO handshakes.
- Enforce role-based authorization across backend routes and surface capabilities to the frontend.
- Role taxonomy: `toolkit.user` (use only), `toolkit.curator` (enable/disable), `system.admin` (full access including security settings).
- Maintain deployability in development (SQLite) while allowing production databases (PostgreSQL/MySQL).

## Backend Components

### Database Layer
- Introduce SQLAlchemy 2.0 with PostgreSQL by default; fall back to SQLite for local development.
- Tables: `users`, `roles`, `user_roles`, `sso_identities`, `audit_logs`, `sessions` (for refresh token tracking), `auth_provider_configs` (optional dynamic configuration).
- Database URL configured via `DATABASE_URL` env var; default `sqlite+aiosqlite:///./data/app.db`.
- Alembic migrations to be introduced in a follow-up iteration (initial metadata creation on startup for now).

### Security Utilities
- Password hashing via `passlib.context.CryptContext` with `bcrypt` hash.
- JWT handling via `PyJWT` with asymmetric key support when configured; default HS256 secret pulled from `AUTH_JWT_SECRET`.
- Token schema: access token (5-15 minutes), refresh token (7-30 days), both include subject, roles, provider, issued at, expiry, token id (for revocation).
- Store refresh tokens keyed by token id for logout and rotation; persist latest metadata in `sessions` table or Redis fallback.

### Auth Providers
- Base abstract class `AuthProvider` with methods: `get_login_metadata`, `begin_auth`, `complete_auth`, `get_display_name`.
- Registry bootstrapped during application startup using provider configs from settings.
- Local provider integrates with database for password validation and multi-factor hook (placeholder).
- `OidcProvider` handles discovery, building authorization URL, validating state/nonce, exchanging code for tokens, verifying ID token signature (JWKS via PyJWT), mapping claims to user record, optional group-to-role mapping.
- `LdapProvider` and `ActiveDirectoryProvider` use `ldap3` for bind authentication; they map distinguished names/groups to roles using configured filters/mappings. AD extends LDAP with start TLS and default attribute mappings.
- Providers return normalized identity payload (user_id, email, display_name, roles, provider_id, attributes) for downstream handling.

### API Surface
- `/auth/login/{provider}` handles local and credential-based providers.
- `/auth/providers` lists enabled providers and `/auth/providers/{provider}/begin` returns redirect metadata (OIDC).
- `/auth/providers/{provider}/callback` finalizes SSO, `/auth/logout`, `/auth/refresh`, `/auth/me` support sessions.
- Admin endpoints for managing users and roles live under `/admin/users`; provider configuration under `/admin/settings/providers` (superuser only).
- Authorization dependencies `get_current_user`, `require_roles`, `require_superuser` gate backend routes.

### Session Management
- Access tokens verified via `Depends`. Refresh tokens stored as httpOnly secure cookies (for browser clients) and as bearer for API clients.
- Token revocation tracked in `sessions` table (token id + expiry + metadata). On logout, session revoked. On refresh, rotate token id.
- Rate limiting and brute-force prevention to leverage Redis in future iteration.

## Frontend Adjustments
- Authentication context to wrap router; store tokens in memory + rely on backend cookies when available.
- Login screen with provider buttons and local form; SSO buttons either redirect (OIDC) or open modal for LDAP credentials.
- Guarded routes redirect to `/login` when unauthenticated. Global layout shows user profile, logout, provider info.
- Refresh token flow triggered on 401, obtains new access token via `/auth/refresh` before retrying API call.

## Configuration
- New env vars: `DATABASE_URL`, `AUTH_JWT_SECRET`, `AUTH_JWT_ALGORITHM`, `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL`, `AUTH_TOKEN_ISSUER`, `AUTH_PROVIDERS`, `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, ... per provider.
- Provider configs can be declared as JSON in env (`AUTH_PROVIDERS_JSON`) or via YAML file referenced by `AUTH_PROVIDERS_FILE`.
- Local admin bootstrap: load `AUTH_BOOTSTRAP_ADMIN` (username/email/password) when DB empty.

## Migration Strategy
- Alembic migrations live under `backend/alembic`; run `alembic upgrade head` (Docker Compose executes this before starting the API) whenever the service boots in a new environment.
- The bootstrap admin helper still runs when the database is empty; you can rotate credentials afterwards from the UI.

## Security Considerations
- Enforce HTTPS in production; mark cookies `Secure` & `SameSite=strict`.
- Validate all SSO callbacks for state + nonce, verify issuer/audience against config, check token expiry.
- Rate limit login attempts (to be implemented with Redis-based limiter).
- Audit logging for auth events stored in `audit_logs`.
- Provide `X-Request-Id` correlation to propagate across services.
- Bind default CORS origins to configured frontends only once auth enforced.

## Open Questions / Next Steps
- Confirm target production database (PostgreSQL vs MySQL).
- Confirm whether service accounts/API keys needed now.
- Decide on migration tooling timeline.
- Determine UI design for multi-provider selection.
