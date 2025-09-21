# Runtime Architecture

This document describes how the SRE Toolbox services interact and which dependencies must be available for the platform to boot successfully in any environment (Docker Compose, Kubernetes, or local shells). For a code-level component map, see `docs/toolbox-architecture.md`.

## Core services

- **API (`backend/app`)** - FastAPI application that exposes REST endpoints, applies Alembic migrations on startup, enforces RBAC, and provisions toolkits.
- **Worker (`backend/worker`)** - Celery process that executes toolkit jobs, publishes progress to Redis, and reads toolkit bundles from shared storage.
- **Vault** - Required secrets manager. The API and worker call Vault on startup to resolve credentials for authentication providers and toolkit settings. Vault data is stored on the `vault-data` volume; the unseal key lives in `config/vault/unseal.key` when running via Docker Compose.
- **PostgreSQL** - Primary database for users, sessions, audit logs, and toolkit metadata. Compose provisions it automatically; local development can target SQLite by switching `DATABASE_URL`.
- **Redis** - Job queue and cache. Tracks Celery task IDs, toolkit registry state, auth cookies, and long-polling progress updates.
- **Toolkit storage** - Bundles live under `TOOLKIT_STORAGE_DIR` (`/app/data/toolkits` in containers). The directory maps to the `toolbox-data` volume so uploads survive rebuilds and are shared by the API and worker.
- **Frontend (`frontend/`)** - Vite dev server in development and a static bundle in production. Toolkits contribute documentation under `frontend/documentation` and runtime UI modules that the shell lazy-loads.

## Startup sequence

1. **Vault** must exist and be unsealed. Configure `VAULT_ADDR`, `VAULT_TOKEN`/`VAULT_TOKEN_FILE`, and `VAULT_KV_MOUNT` in `.env`. Use `./bootstrap-stack.sh` to initialise and unseal the container without overwriting existing keys or secrets.
2. **toolbox-data-init** (Compose service) sets ownership on the shared toolkit volume when the stack starts.
3. **PostgreSQL** and **Redis** start and expose their default ports. The API uses healthchecks to wait for them.
4. **API container** runs `alembic upgrade head` before starting Uvicorn. If migrations fail, the service exits.
5. **Worker** waits on Redis, Postgres, and Vault before launching Celery to ensure toolkit registration succeeds.
6. **Frontend** attaches once the API reports healthy. During development, Vite proxies `/auth` to the local API.

If any dependency is unavailable (for example, Vault is sealed), the API and worker exit on startup rather than running with partial configuration. Fix the upstream issue and recreate the container so the healthchecks pass.

## Data paths and volumes

| Path | Description | Backing store |
|------|-------------|---------------|
| `/app/data` | Application state (SQLite fallback, toolkit bundles, file uploads) | Docker volume `toolbox-data` |
| `/vault/data` | Vault storage | Docker volume `vault-data` |
| `/vault/config/unseal.key` | Unseal key consumed by `docker/vault/entrypoint.sh` | Bind mount `config/vault/unseal.key` |

Inspect volumes with `docker volume inspect <name>` and clean them with `docker volume rm <name>` when you need a fresh environment.

## Environment variables of note

- `DATABASE_URL`, `REDIS_URL`, `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_KV_MOUNT`, `FRONTEND_BASE_URL`, `VITE_API_BASE_URL` - minimal set required for a healthy stack.
- `TOOLKIT_STORAGE_DIR`, `TOOLKIT_UPLOAD_MAX_BYTES`, `TOOLKIT_BUNDLE_MAX_BYTES`, `TOOLKIT_BUNDLE_MAX_FILE_BYTES` - govern where toolkits live and how uploads are validated.
- `AUTH_JWT_SECRET` / `AUTH_JWT_PRIVATE_KEY` / `AUTH_JWT_PUBLIC_KEY` - signing material for access/refresh tokens; the API refuses to start unless the secret is ≥32 characters or an asymmetric key pair is supplied.
- `BOOTSTRAP_ADMIN_*` - optional first-run administrative account seeded during API startup.

Keep `.env` authoritative for local development. Production orchestration should inject secrets through Vault, AppRole tokens, or environment-specific secret stores.

## Operational guidance

- Monitor the `toolbox-data` volume size to ensure toolkit bundles do not exhaust disk space.
- Rotate Vault tokens regularly; use `VAULT_TOKEN_FILE` when running in CI/CD so credentials are not committed.
- After uploading or uninstalling toolkits manually, reload the API or use the Admin → Toolkits UI to sync the registry.
- When debugging toolkit load issues, confirm the bundle exists on the shared volume and that the worker successfully imported the module (logs appear on the worker container/stdout).

Refer to `docs/project-setup.md` for hands-on bootstrap steps and `docs/toolkit-authoring` for authoring guidelines.
