# Toolbox Architecture

This document describes the software architecture of the SRE Toolbox codebase. Use it alongside `docs/runtime-architecture.md`, which focuses on deployment topology and infrastructure dependencies.

## High-level overview

The Toolbox is organised around three cooperating runtimes:

1. **Backend control plane** – a FastAPI application that exposes REST endpoints, handles RBAC, and manages toolkit lifecycles.
2. **Worker runtime** – a Celery worker that executes long-running toolkit tasks and streams telemetry back to operators.
3. **React App Shell** – a Vite-built SPA that mounts toolkit micro-frontends and surfaces shared operator workflows.

All three share a common domain model (PostgreSQL or SQLite), a Redis-backed event bus, and Vault-managed secrets. Toolkits extend the platform by supplying modular bundles that plug into each runtime.

## Backend control plane

- Entrypoint: `backend/app/main.py` mounts versioned routers, health checks, and toolkit endpoints.
- Configuration: `backend/app/config.py` reads environment variables and Vault secrets; `bootstrap.py` seeds initial roles and admin accounts.
- Persistence: SQLAlchemy models under `backend/app/models` map to users, roles, toolkits, sessions, audit logs, and auth provider configs. Alembic migrations live in `backend/alembic/`.
- Security: Authentication is implemented via JWT (FastAPI dependencies in `backend/app/security/`). Role checks use dependency overrides in `backend/app/dependencies.py`.
- Toolkit loading: `backend/app/toolkit_loader.py` scans the toolkit storage directory, validates manifests, mounts routers, and registers dashboard metadata at runtime.

## Worker runtime

- Entrypoint: `backend/worker/app.py` initialises Celery with Redis and database configuration.
- Registration: Toolkit bundles export a `register` callable that receives Celery and shared helpers; the loader imports modules dynamically from the toolkit storage directory.
- Job orchestration: Tasks enqueue progress updates via Redis (`backend/app/worker_client.py`) so the API can surface live job status on `/jobs`.
- Observability: Structured logs carry toolkit slug, task ID, and operator id. Faulted jobs bubble status back through Redis and the API for operator review.

## React App Shell

- Located at `frontend/src/AppShell.tsx`, the shell renders shared navigation, route guards, and a runtime host for toolkit UIs.
- Runtime globals (`window.__SRE_TOOLKIT_RUNTIME`) expose API helpers, error boundaries, and UI primitives that toolkit frontends consume.
- Documentation lives under `frontend/documentation/`; toolkit bundles can link directly to these pages from dashboard cards.

## Toolkit runtime contract

1. **Packaging** – Toolkits ship as zip archives containing `toolkit.json` plus optional backend, worker, and frontend modules. Scripts under `toolkits/scripts/` help validate and package bundles.
2. **Installation** – Operators upload archives through Admin → Toolkits or `POST /toolkits/install`. The installer unpacks bundles into `TOOLKIT_STORAGE_DIR/<slug>/`.
3. **Activation** – On startup (or after an install event) the loader imports backend routers and worker registration hooks, then advertises dashboard cards and frontends to the App Shell.
4. **Execution** – API endpoints enqueue jobs to Celery, which pulls runtime dependencies (database, Redis, external APIs) defined by the toolkit.

Community distribution: the Admin → Toolkits → Community Catalog view queries <https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json> (overridable via `TOOLKIT_CATALOG_URL` or Administration → Toolbox settings) so curators can review community-contributed toolkits and, once bundles are published, request installations directly from the catalog.

## Request and job lifecycles

- *API request*: HTTP request enters FastAPI → dependency stack validates auth and roles → service layer executes business logic → responses serialise through Pydantic schemas in `backend/app/schemas/`.
- *Toolkit job*: Operator submits action → API enqueues Celery task with context (toolkit slug, operator id) → worker executes and sends progress events via Redis → API aggregates events for `/jobs` polling and websocket updates → results stored in Postgres as needed by the toolkit.

## Cross-cutting concerns

- **Secrets management** – Vault provides external credentials; the API retrieves them through `backend/app/secrets` helpers to avoid storing secrets in plain text.
- **RBAC** – Role metadata lives in the `roles` table; dependencies ensure only privileged users access toolkit curation, auth provider settings, or system administration routes.
- **Audit logging** – `backend/app/services/audit.py` records security-sensitive events; entries surface via admin tooling and inform incident response.
- **Testing** – Backend tests use pytest/pytest-asyncio; frontend tests rely on Vitest. `test-all.sh` orchestrates both suites for CI consistency.

## Repository landmarks

- `backend/` – FastAPI API, Celery worker, Alembic migrations.
- `frontend/` – React App Shell, shared documentation, toolkit UI scaffolding.
- `toolkit_runtime/` – Shared helpers injected at runtime (Redis channels, Celery config, API client).
- `toolkits/` – Reference toolkits and packaging utilities.
- `docs/` – Engineering documentation (runtime architecture, project setup, toolkit authoring, this architecture guide).
- `ai/` – Automation playbooks and Codex state (`ai/ops/codex.md`, `ai/state/*`).

For infrastructure-specific wiring (ports, containers, volumes) refer to `docs/runtime-architecture.md` and `docker-compose.yml`.
