# Project Setup

Follow this guide when cloning the repo or preparing a new development environment.

## Prerequisites
- Python 3.11+
- Node.js 18+
- Redis 6+ (Docker Compose manages this automatically)
- PostgreSQL (optional for local dev; SQLite works out of the box)

## Backend API
1. `cd backend`
2. `python -m venv .venv`
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `uvicorn app.main:app --reload --port 8080`

## Celery Worker
1. `cd backend`
2. `source .venv/bin/activate`
3. `celery -A worker.worker:celery_app worker --loglevel=INFO`

## Frontend Shell
1. `cd frontend`
2. `npm install`
3. `npm run dev -- --host 0.0.0.0 --port 5173`

> **Security note**: The Vite dev server only whitelists `frontend/` and bundled toolkit sources under `toolkits/bundled/`. Keep
> toolkit code you want hot reloaded inside that directory so you don't need to broaden the filesystem allowlist.

## Docker Compose (all services)
1. Copy `.env.example` to `.env` and adjust values.
2. (Optional) Initialize HashiCorp Vault before bringing up the rest of the stack (see **Secrets Manager** below).
3. Run `docker compose up --build` from the repo root.
4. Visit:
   - UI → http://localhost:5173
   - API docs → http://localhost:8080/docs

## Toolkit Storage
- Bundled toolkits install on first boot under `TOOLKIT_STORAGE_DIR` (defaults to `./data/toolkits`).
- Upload additional bundles from Admin → Toolkits or via `POST /toolkits/install`.
- Toolkit uploads are capped by `TOOLKIT_UPLOAD_MAX_BYTES` (compressed size) and unpacking safeguards `TOOLKIT_BUNDLE_MAX_BYTES` / `TOOLKIT_BUNDLE_MAX_FILE_BYTES` to block zip bombs; tweak these in `.env` when needed.
- Uploaded bundle filenames are normalised—directory segments are stripped and collisions gain a random suffix before the artefact is persisted.

## Secrets Manager (HashiCorp Vault)
- Compose now starts a `vault` container alongside the API, worker, Redis, and Postgres. The instance uses file storage under `./vault-data` and exposes the UI and API on `http://localhost:8200`.
- One-time initialization:
  ```bash
  docker compose up -d vault
  docker compose exec vault vault operator init -key-shares=1 -key-threshold=1
  docker compose exec vault vault operator unseal <unseal-key>
  ```
  Store the generated recovery key and root token securely; the commands above output them once.
- Enable a KV v2 secrets engine and seed credentials (adjust the mount and paths to match your org):
  ```bash
  docker compose exec vault vault login <root-or-approle-token>
  docker compose exec vault vault secrets enable -path=sre kv-v2
  docker compose exec vault vault kv put sre/auth/okta client_secret=replace-me
  docker compose exec vault vault kv put sre/auth/ldap bind_password=replace-me
  ```
- Add Vault environment variables to `.env` so the API/worker containers can retrieve secrets:
  ```dotenv
  VAULT_ADDR=http://vault:8200
  VAULT_TOKEN=<short-lived-token-or-use-VAULT_TOKEN_FILE>
  VAULT_KV_MOUNT=sre
  VAULT_TLS_SKIP_VERIFY=true  # dev only; prefer TLS in production
  ```
- Point the backend at an auth provider configuration file (see `config/auth-providers.example.json`) or manage providers from **Administration → Auth settings**. When using the file approach, set `AUTH_PROVIDERS_FILE=./config/auth-providers.json` and mount the directory in production deployments.

## Audit Logging
- Set `AUDIT_LOG_RETENTION_DAYS` (default `90`) to control how long audit entries persist before automatic cleanup.
- Administrators can adjust retention and review audit history in the UI under **Administration → Security**; backend changes to the env var provide the default.
