# Project Setup

Follow this guide when cloning the repo or preparing a new development environment.

## Prerequisites
- Python 3.11+
- Node.js 18+
- Docker 24+ / Docker Compose plugin
- HashiCorp Vault 1.14+ (required)
- Redis 7+ and PostgreSQL 15+ (both provided through Docker Compose)

Ensure PostgreSQL, Redis, and Vault are running (e.g. by executing `./bootstrap-stack.sh`, which also handles Vault initialisation) before launching the processes below. Update `.env` so connection strings point at `127.0.0.1` if you run them outside Docker.

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
>
> For authentication flows the dev server proxies `/auth` to the backend API. Point it at your API origin by exporting
> `VITE_DEV_API_PROXY=http://localhost:8080` (or set `VITE_API_BASE_URL`). This keeps refresh cookies scoped to the API host
> while allowing the SPA to perform SSO hand-offs locally.

## Docker Compose (all services)
1. Copy `.env.example` to `.env`, then generate strong values for `POSTGRES_USER`, `POSTGRES_PASSWORD`, and (optionally) `POSTGRES_DB`. Update `DATABASE_URL` to match those credentials and replace the JWT placeholder with a random ≥32 character secret (for example, run `openssl rand -hex 32`). The compose stack refuses to start if the Postgres secrets are left blank.
2. Run `./bootstrap-stack.sh` (see **Secrets Manager** below) so Vault is initialised, unsealed, and seeded before other services start.
3. Run `docker compose up --build` from the repo root. The API performs migrations automatically on start-up.
4. Visit:
   - UI → http://localhost:5173
   - API docs → http://localhost:8080/docs
   - Vault UI → http://localhost:${VAULT_HOST_PORT:-8200}

## Toolkit Storage
- Toolkit bundles unpack into `TOOLKIT_STORAGE_DIR` (defaults to `/app/data/toolkits` inside the containers). The directory is backed by the named Docker volume `toolbox-data`, so uploads survive image rebuilds.
- The `toolbox-data-init` service in `docker-compose.yml` sets ownership on the volume during startup. Rerun `docker compose up toolbox-data-init` if you change the UID/GID in `.env`.
- Inspect stored bundles with `docker compose exec api ls /app/data/toolkits`. Remove a toolkit by uninstalling it from the UI or deleting the corresponding directory before restarting the API/worker.
- To start with a clean slate, stop the stack and run `docker volume rm $(docker volume ls -q --filter name=toolbox-data)` (this wipes bundled and uploaded toolkits).
- When developing outside Docker, set `TOOLKIT_STORAGE_DIR` to an absolute path that your local user can read/write.

## Secrets Manager (HashiCorp Vault)
- Vault is a hard requirement: the API and worker refuse to start if they cannot read secrets. The `vault` service in `docker-compose.yml` uses the official HashiCorp image, persists data under the `vault-data` volume, and is fronted by `docker/vault/entrypoint.sh` to auto-unseal with a stored key.
- Listener and storage defaults live in `config/vault/local.hcl`. If you change ports, update **both** `VAULT_LISTEN_PORT` and `VAULT_HOST_PORT` in `.env` and adjust `VAULT_ADDR` so the containers and your host stay aligned.
- First-run bootstrap is automated via `./bootstrap-stack.sh`. The helper initialises Vault when required, writes the generated unseal key to `config/vault/unseal.key`, and persists the root token to `.vault-token` (or the path referenced by `VAULT_TOKEN_FILE`) without overwriting existing material. It also enables the `${VAULT_KV_MOUNT:-sre}` kv-v2 engine and seeds placeholder secrets under `/auth/oidc` and `/auth/ldap` when they are missing. Replace the placeholder values with real credentials before wiring toolkits to them.
- Create additional secrets under paths your toolkits reference as needed.
- Populate the Vault environment variables in `.env` so the API and worker can authenticate:
  ```dotenv
  VAULT_ADDR=http://vault:8200
  VAULT_TOKEN=<token-with-access-to-${VAULT_KV_MOUNT:-sre}>
  VAULT_KV_MOUNT=sre
  VAULT_TLS_SKIP_VERIFY=true  # dev only; prefer TLS or a custom CA bundle in production
  # VAULT_TOKEN_FILE=./.vault-token
  # VAULT_CA_CERT=/etc/ssl/certs/your-ca.pem
  # VAULT_AUTH_METHOD=token  # switch to approle for production
  ```
  For AppRole-based auth, populate `VAULT_AUTH_METHOD=approle` and supply `VAULT_APPROLE_ROLE_ID` / `VAULT_APPROLE_SECRET_ID` instead of `VAULT_TOKEN`.
- Use **Administration → Auth settings** (or `AUTH_PROVIDERS_FILE`) to reference Vault secrets via `*_vault` fields, keeping credentials out of JSON documents and environment variables.

## Audit Logging
- Set `AUDIT_LOG_RETENTION_DAYS` (default `90`) to control how long audit entries persist before automatic cleanup.
- Administrators can adjust retention and review audit history in the UI under **Administration → Security**; backend changes to the env var provide the default.
