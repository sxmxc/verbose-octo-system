# Toolbox Schema Reference

This file captures the domain schema most relevant to Codex automation. It focuses on persistent database entities and the canonical payloads exchanged between the API, worker, and frontend.

## Database entities

The Toolbox uses SQLAlchemy models located under `backend/app/models`. Key tables and relationships are summarised below.

### Users and identity

- **`users`** (`User` model)
  - Primary key `id` (`uuid4` string).
  - Uniqueness constraints on `username` and `email`.
  - Flags include `is_active`, `is_superuser`.
  - Timestamps: `created_at`, `updated_at`, `last_login_at`.
  - Relationships: `roles` (many-to-many via `user_roles`), `identities` (one-to-many `sso_identities`), `sessions` (one-to-many `auth_sessions`).
- **`roles`** (`Role` model)
  - Primary key `id` (`uuid4` string) with unique `slug`.
  - Descriptive `name` and optional `description`.
  - Many-to-many back to `users`.
- **`user_roles`** (`UserRole` model)
  - Association table linking `users` and `roles`, with assignment timestamp.
- **`sso_identities`** (`SsoIdentity` model)
  - Links a user to an external provider (`provider`, `subject`).
  - Optional `raw_attributes` stores provider payload snapshots (JSON string).
- **`auth_sessions`** (`AuthSession` model)
  - Tracks refresh tokens with `refresh_token_hash`, expiry, optional `client_info`, and `revoked_at`.

### Authentication providers and system settings

- **`auth_provider_configs`** (`AuthProviderConfig`)
  - Stores JSON configuration blobs (`config`) for OIDC/LDAP/AD and local providers.
  - `enabled` flag controls runtime availability.
- **`system_settings`** (`SystemSetting`)
  - Simple key/value store used for bootstrap flags and global toggles.

### Toolkits

- **`toolkits`** (`Toolkit`)
  - Primary key `slug` with metadata (`name`, `description`, `category`, `tags`, `origin`).
  - Runtime wiring: `backend_module`, `backend_router_attr`, `worker_module`, `worker_register_attr`, `frontend_entry`, `frontend_source_entry`.
  - Dashboard metadata: JSON arrays for `dashboard_cards` and optional context loader fields.
  - `enabled` toggles availability; timestamps track creation/update.
- **`toolkit_removals`** (`ToolkitRemoval`)
  - Records slugs that were explicitly uninstalled so re-registration can enforce safeguards.

### Audit trail

- **`audit_logs`** (`AuditLog`)
  - Captures security events with severity (`event`, `severity`, `payload`).
  - Optional `user_id` (nullable, `SET NULL` on delete), `source_ip`, `user_agent`.
  - `target_type` and `target_id` link to affected resources for forensics.

## Redis structures

Redis acts as the job queue and transient state store:

- **Celery tasks** – default queue named `sre-toolbox`. Task IDs follow `<toolkit_slug>.<operation>` naming.
- **Job telemetry** – progress events publish to channels namespaced by task ID (`toolkit:<slug>:job:<uuid>`). Payloads include `status`, `message`, `progress`, and optional `payload` JSON.
- **Runtime cache** – stores authentication session locks, toolkit registry digests, and feature flags. Keys are prefixed (`auth:`, `toolkit:cache:`) for clarity.

## Pydantic schemas

API responses serialise through Pydantic models in `backend/app/schemas/`:

- **`user.py`** – defines `UserRead`, `UserCreate`, `RoleRead`, `AuthSessionRead`, and helper models for assigning roles.
- **`audit.py`** – provides `AuditLogEntry` for listing audit events and filtering by severity/date.

Each schema mirrors the SQLAlchemy entity fields but constrains visibility (e.g., hides password hashes, surfaces only read-safe session data).

## Key invariants

- Usernames and role slugs are case-sensitive and globally unique.
- Toolkit slugs must remain URL-safe and match the on-disk directory under `TOOLKIT_STORAGE_DIR`.
- Revoking a session sets `revoked_at` but retains the row for auditability; API callers must check both expiry and revocation.
- Toolkit removals prevent silent reactivation: reinstalling requires clearing the removal record or using the admin UI which performs the reset explicitly.

For migration history and DDL, inspect Alembic revisions in `backend/alembic/versions/`. Runtime relationships (e.g., job telemetry payloads) are enforced contractually rather than with SQL constraints, so keep this document aligned with code when schemas evolve.
