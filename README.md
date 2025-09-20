# SRE Toolbox

[![CI](https://github.com/sxmxc/verbose-octo-system/actions/workflows/ci.yml/badge.svg)](https://github.com/sxmxc/verbose-octo-system/actions/workflows/ci.yml) [![Docs](https://img.shields.io/badge/docs-quick%20start-0a0a0a?logo=readthedocs&logoColor=white)](docs/README.md) [![Compose](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml) [![Contribution Guide](https://img.shields.io/badge/contribute-guidelines-0366d6?logo=github)](docs/contributing.md)

SRE Toolbox is a modular operations cockpit for site reliability teams. The lightweight core exposes a FastAPI control plane, a Celery worker, and a React shell. Feature teams ship functionality as **toolkits** that bundle API routers, background jobs, documentation, and optional UI panels that operators can enable at runtime.

```
┌─────────────┐        HTTP        ┌──────────────┐          SQL          ┌──────────────┐
│ React App   │◀──────────────────▶│ FastAPI API   │◀─────────────────────▶│ PostgreSQL   │
│ (App Shell) │                     │ + Toolkit SDK │                        │ / SQLite     │
└─────────────┘                     └──────────────┘                        └──────────────┘
        ▲                                   ▲                                     ▲
        │                                   │                                     │
        │                             ┌──────────────┐                            │
        │    Job telemetry            │ Celery Worker│                            │
        └────────────────────────────▶│  + Toolkits  │────────────────────────────┘
                                      └──────────────┘
                 Redis (job queue, toolkit registry, auth state)
```

## Key capabilities

- **Toolkit-first architecture** – integrations ship as self-contained bundles with API routers, Celery tasks, dashboard cards, docs, and optional React frontends mounted under `/toolkits/<slug>`.
- **Dynamic runtime loading** – backend and worker modules are imported from toolkit bundles, keeping namespaces isolated even when teams reuse common module names.
- **Unified job control** – Redis tracks toolkit jobs, execution logs, cancellation state, and Celery task IDs for end-to-end visibility.
- **Persistent state** – SQLAlchemy models backed by PostgreSQL (or SQLite for local development) handle users, roles, sessions, and provider configuration.
- **Adaptive app shell** – the React sidebar renders toolkit navigation dynamically and injects shared UI primitives (`tk-*` components) so micro-frontends inherit Toolbox theming without custom CSS.
- **Hardened access control** – JWT-backed authentication with local, OIDC, LDAP, or Active Directory providers that can be configured at runtime.
- **Vault-backed secrets** – optional HashiCorp Vault sidecar keeps OIDC/LDAP credentials out of config files via secret references.
- **Security audit trail** – centralized logging of authentication, permission, and toolkit lifecycle events with configurable retention and administrator-only viewing tools.
- **Container ready** – `docker compose up --build` brings up the API, worker, Redis, and Vite dev server in one command.

## Repository layout

- `backend/` – FastAPI service, Celery worker entrypoints, SQLAlchemy models, Redis helpers, and toolkit loader.
- `frontend/` – React + Vite SPA; `src/AppShell.tsx` hosts global navigation and lazy-loads toolkit micro-frontends.
- `toolkits/bundled/` – example toolkits (Regex playground, Zabbix helpers) packaged the same way third-party toolkits are distributed.
- `docs/` – internal engineering guides (prompt engineering playbooks, coding standards, contribution notes, toolkit authoring).
- `docker-compose.yml` – local orchestration for API, worker, Redis, and frontend.
- `.env.example` – default environment variables for local development.

## Built with

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](backend) [![Pydantic](https://img.shields.io/badge/Pydantic-ff7f50?logo=python&logoColor=white)](backend) [![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-d71f00?logo=python&logoColor=white)](backend) [![Alembic](https://img.shields.io/badge/Alembic-migrations-2d2d2d)](backend) [![Celery](https://img.shields.io/badge/Celery-task%20queue-37814A)](backend) [![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](backend)  
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](frontend) [![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](frontend) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](frontend) [![Vitest](https://img.shields.io/badge/Vitest-unit%20tests-6E9F18)](frontend)

- **FastAPI** + **Pydantic** for the API surface, validation, and dependency injection.
- **SQLAlchemy** (async) with **Alembic** migrations targeting PostgreSQL in production and SQLite in development.
- **Celery** + **Redis** for background jobs and toolkit runtime metadata.
- **React 18**, **React Router**, **Vite**, and **TypeScript** for the web shell and toolkit micro-frontends.
- **Vitest** for frontend unit tests and **unittest** for backend/worker suites.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Redis 6+ (managed automatically when using Docker Compose)
- (Optional) PostgreSQL when running the FastAPI API against a production-grade database

## Quick start (Docker Compose)

1. Copy `.env.example` to `.env` and adjust values for your environment.
2. Start the stack:

   ```bash
   docker compose up --build
   ```

3. Default endpoints:
   - UI → <http://localhost:5173>
   - API docs → <http://localhost:8080/docs>

Bundled toolkits install themselves on first boot and are cached under `TOOLKIT_STORAGE_DIR` (defaults to `./data/toolkits`).

## Manual development workflow

### Backend API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### Celery worker

```bash
cd backend
source .venv/bin/activate
celery -A worker.worker:celery_app worker --loglevel=INFO
```

### Frontend shell

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

The Vite dev server only allows files from `frontend/` and checked-in bundled toolkits (`toolkits/bundled`) to be served. When
iterating on a bundled toolkit locally, keep its source within that directory so hot module reloading continues to work without
exposing additional host paths.

## Configuration

Core settings are read from environment variables (see `.env.example`). The table below highlights the most common knobs.

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_ENV`, `LOG_LEVEL` | FastAPI runtime controls | see `.env.example` |
| `DATABASE_URL` | SQLAlchemy async database URL | `sqlite+aiosqlite:///./data/app.db` |
| `REDIS_URL` / `REDIS_PREFIX` | Redis connection string and key prefix | `redis://redis:6379/0`, `sretoolbox` |
| `TOOLKIT_STORAGE_DIR` | Filesystem directory for toolkit bundles | `./data/toolkits` |
| `TOOLKIT_UPLOAD_MAX_BYTES` / `TOOLKIT_BUNDLE_MAX_BYTES` / `TOOLKIT_BUNDLE_MAX_FILE_BYTES` | Upload and extraction safeguards that block oversized bundles | `52428800` / `209715200` / `104857600` |
| `FRONTEND_BASE_URL` | UI origin (no trailing slash) for automatic CORS configuration | `http://localhost:5173` |
| `VITE_API_BASE_URL` | Frontend discovery of the API endpoint | `http://localhost:8080` |
| `AUTH_JWT_SECRET` / `AUTH_JWT_PUBLIC_KEY` / `AUTH_JWT_PRIVATE_KEY` / `AUTH_JWT_ALGORITHM` | Signing secret or key pair and algorithm for access tokens | `change-me`, unset, unset, `HS256` |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` / `AUTH_REFRESH_TOKEN_TTL_SECONDS` | Token lifetimes for access and refresh tokens | `900` / `1209600` |
| `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN` | Refresh-token cookie attributes | `true`, `lax`, unset |
| `AUTH_PROVIDERS_JSON` / `AUTH_PROVIDERS_FILE` | Bootstrap SSO providers via JSON payload or file path | unset |
| `AUTH_SSO_STATE_TTL_SECONDS` | Lifetime for signed SSO state/nonce records | `600` |
| `BOOTSTRAP_ADMIN_*` | Optional seed admin account (username, password, email) | unset |

Additional provider-specific settings (OIDC, LDAP/AD) can be injected via `AUTH_PROVIDERS_JSON` or added at runtime through the Admin → Auth settings screen.

## Using the platform

- **Dashboard** – consolidated overview with toolkit-supplied cards and recent jobs.
- **Jobs** – pollable list with inline log streaming and cancellation that propagates to Celery.
- **Toolkits index** – view metadata, enable/disable toolkits, and open toolkit documentation.
- **Toolkit routes** – `/toolkits/:slug/*` renders toolkit-provided React layouts or a friendly placeholder when no UI bundle ships.
- **Administration → Toolkits** – upload `.zip` bundles, toggle visibility, uninstall toolkits, and inspect metadata derived from `toolkit.json`.
- **Administration → Users** – invite local users, assign roles, or import external identities.
- **Administration → Auth settings** – configure local, OIDC, LDAP, or Active Directory providers without redeploying.

## Authentication & role-based access control

- **Roles** – every account receives `toolkit.user` for day-to-day operations. Grant `toolkit.curator` to manage toolkit enablement and `system.admin` for security-sensitive settings (auth providers, user management, audit exports). All FastAPI routes and in-app controls honor these roles.
- **Providers** – configure local username/password auth or plug in OpenID Connect, LDAP, and Active Directory providers. Define providers inline via `AUTH_PROVIDERS_JSON`, point at a JSON file with `AUTH_PROVIDERS_FILE`, or manage them at runtime from **Administration → Auth settings**. Changes reload instantly—no restart required.
- **Session hygiene** – access tokens default to 15 minutes, refresh tokens to 14 days, and the API rotates refresh-token IDs on each renewal while persisting session metadata for revocation and auditing. Set `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, and `AUTH_COOKIE_DOMAIN` to harden browser usage.
- **SSO state** – requests are protected by signed state/nonce values with a configurable TTL (`AUTH_SSO_STATE_TTL_SECONDS`); pair this with HTTPS so cookies stay protected in transit.

## Bundled toolkits

- **Zabbix Toolkit** (`toolkits/bundled/zabbix`) – manage Zabbix API endpoints, test connectivity, and queue bulk host operations. Dashboard metrics come from `backend/dashboard.py`; runtime workers live in `worker/tasks.py`.
- **Regex Toolkit** (`toolkits/bundled/regex`) – experiment with regular expressions, flags, and captured groups while showcasing the shared UI primitives.

These bundles mirror the format expected by the runtime, so you can use them as blueprints when authoring new toolkits.

## Building a toolkit

1. **Scaffold `toolkit.json`** with `slug`, `name`, and module entrypoints for backend/worker/frontend components.
2. **Backend module** – expose a FastAPI `APIRouter` (default attribute `router`) that is mounted under `/toolkits/<slug>`.
3. **Worker module** – export a callable (default `register`) to register Celery tasks like `<slug>.<operation>`. The runtime injects the shared Celery app and a `register_handler` helper when requested.
4. **Frontend bundle (optional)** – ship an ESM entry at `frontend/dist/index.js`. During development, toolkits can point to `frontend/index.tsx` so Vite provides hot reloads. At runtime the App Shell injects `React`, `React Router`, and `apiFetch` through `window.__SRE_TOOLKIT_RUNTIME`.
5. **Package** – run `python toolkits/scripts/package_toolkit.py <path>` to validate the manifest and emit `<slug>_toolkit.zip`. Upload the archive from Admin → Toolkits or via `POST /toolkits/install`. The installer rejects archives containing absolute paths, drive letters, parent-directory segments, or symlinks and, once validated, unpacks bundles into `TOOLKIT_STORAGE_DIR/<slug>/` while serving static assets from `/toolkit-assets/<slug>/…`.

Example manifest:

```json
{
  "slug": "incident-bots",
  "name": "Incident Bots",
  "description": "ChatOps responders",
  "backend": { "module": "backend.app", "router_attr": "router" },
  "worker": { "module": "worker.tasks", "register_attr": "register" },
  "frontend": { "entry": "frontend/dist/index.js", "source_entry": "frontend/index.tsx" },
  "dashboard_cards": [
    { "title": "ChatOps Bot", "body": "Run responders from the dashboard.", "link_href": "/toolkits/incident-bots" }
  ],
  "dashboard": { "module": "backend.dashboard", "callable": "build_context" }
}
```

## Testing

Run tests from the component directories so dependencies resolve correctly.

### Backend + worker tests

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m unittest discover tests
```

The suite covers FastAPI auth flows, toolkit registry helpers, worker job orchestration, and security primitives. Redis interactions are faked in unit tests, so a live Redis instance is not required.

### Frontend tests

```bash
cd frontend
npm install
npm test
```

Vitest exercises the shared API client (`apiFetch`) and the local auth token store. The script runs in watchless mode (`vitest run`) by default; append `--watch` during development if desired.

### Optional end-to-end checks

While not bundled, you can run the full stack (`docker compose up --build`) and manually verify toolkit enablement, job submission, and authentication provider switches through the UI.

## Contributing

- Keep assets ASCII-only unless a feature requires otherwise.
- Format Python code with `ruff`/`black`; run TypeScript through `npm run build` prior to submitting changes.
- Always execute the test suites above before opening a PR.
- Document new toolkits so operators understand how to deploy them safely.

> **Security note:** the bundled Zabbix Toolkit is provided for developer workflows. Add authentication, audit logging, and throttling before using it in production.
