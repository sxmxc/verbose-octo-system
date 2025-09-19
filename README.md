# SRE Toolbox

SRE Toolbox is a modular operations cockpit. The core stack stays lightweight, while feature teams deliver functionality as **toolkits** that can bundle API routes, background jobs, and React panels. Operators enable or disable toolkits at runtime without rebuilding the platform.

```
┌─────────────┐        HTTP        ┌──────────────┐
│ React App   │◀──────────────────▶│ FastAPI API   │
│ (App Shell) │                     │ + Toolkit SDK │
└─────────────┘                     └──────────────┘
        ▲                                   ▲
        │                                   │
        │                             ┌──────────────┐
        │    Job telemetry            │ Celery Worker│
        └────────────────────────────▶│  + Toolkits  │
                                      └──────────────┘
                 Redis (job queue and toolkit registry)
```

## Highlights

- **Toolkit-first architecture** – each integration ships as a self-contained bundle that can expose API routers, Celery operations, dashboard cards, documentation, and optional React panels mounted under `/toolkits/<slug>`.
- **Isolated runtime loader** – backend, worker, and dashboard modules are imported from the toolkit's bundle, so extensions remain independent even when they reuse generic names like `backend.app` or `worker.tasks`.
- **Unified control plane** – jobs are tracked in Redis, stream execution logs to the UI, and expose cancellation hooks for long running tasks.
- **Dynamic App Shell** – the React sidebar sources its navigation from the runtime registry, rendering either the toolkit's layout component or a placeholder when no UI is shipped.
- **Shared UI primitives** – the shell injects `tk-*` button, input, and card helpers so bundled frontends inherit Toolbox theming without custom CSS.
- **Bundled examples** – the Zabbix automation toolkit and Regex playground install automatically so teams can explore the workflow end to end.
- **Container-native** – a single `docker compose up --build` bootstraps the API, worker, Redis, and the Vite dev server.

## Repository layout

- `backend/` – FastAPI service, Celery app, Redis integrations, and toolkit loader.
- `frontend/` – React + Vite SPA (`frontend/src/AppShell.tsx` hosts the dynamic navigation and toolkit router).
- `toolkits/bundled/` – reference toolkits distributed with the platform (each contains `backend/`, `worker/`, `frontend/`, a prebuilt `frontend/dist/index.js`, and `toolkit.json`).
- `docker-compose.yml` – local orchestration for API, worker, Redis, and the frontend dev server.
- `.env.example` (at repo root) – template for core environment variables.

## Documentation

The in-app documentation hub renders markdown from `frontend/documentation`. Core guides include:

- `toolbox-overview.md` – high-level orientation for the Toolbox framework.
- `toolbox-administration.md` – enabling, disabling, and installing toolkits.
- `toolbox-job-monitoring.md` – observing and troubleshooting queued work.
- `toolkit-ui.md` / `toolkit-worker.md` – authoring UI panels and workers with the shared primitives.
- `examples-*.md` – end-to-end walkthroughs you can clone for new integrations.

## Getting started

### 1. Configure

1. Copy `.env.example` to `.env`.
2. Adjust `TOOLKIT_STORAGE_DIR` if you want bundles persisted outside the repo.
3. Set `VITE_API_BASE_URL`/`VITE_API_PORT` if your API will live on a non-default address.

### 2. Run with Docker Compose

```bash
docker compose up --build
```

- UI → `http://localhost:5173`
- API docs → `http://localhost:8080/docs`

Bundled toolkits are installed automatically on the first start and cached under `TOOLKIT_STORAGE_DIR`.

### Manual development workflow

```bash
# Backend API
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Celery worker (new shell)
cd backend
source .venv/bin/activate
celery -A worker.worker:celery_app worker --loglevel=INFO

# Frontend UI (new shell)
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Using the platform

- **Dashboard** – overview cards plus recent job activity.
- **Jobs** – pollable table with status filters and inline log streaming; cancellations propagate to Celery.
- **Toolkits index** – list of registered toolkits showing enable/disable state, documentation links, and sidebar targets.
- **Toolkit routes** – `/toolkits/:slug/*` renders the toolkit's exported React layout. When a toolkit ships no UI, the App Shell renders a friendly placeholder instead.
- **Administration → Toolkits** – upload `.zip` bundles, toggle visibility, uninstall toolkits, and review metadata extracted from `toolkit.json`.

## Bundled toolkits

- **Zabbix Toolkit** (`toolkits/bundled/zabbix`) – manage multiple Zabbix API endpoints, perform connectivity tests, and queue bulk host actions via background jobs. The UI is built from `frontend/index.tsx`, the deployable micro-frontend lives at `frontend/dist/index.js`, and dashboard metrics come from `backend/dashboard.py`.
- **Regex Toolkit** (`toolkits/bundled/regex`) – evaluate expressions against sample input with toggleable flags and capture-group inspection. It follows the same source/dist layout for its UI entry points and showcases the `tk-*` primitives for forms and buttons.

Both bundles mirror the structure expected by the runtime (with or without an extra root folder when zipped) and behave like any other toolkit: disable them from the UI and their routes vanish immediately.

## Building your own toolkit

1. **Scaffold** `toolkit.json` with at least `slug`, `name`, `version`, and entries for `backend`/`worker` modules.
2. **Backend** – expose a FastAPI `APIRouter` that the platform mounts under `/toolkits/<slug>`.
3. **Worker** – export a function (default name `register`) that takes the shared Celery app (and optionally a `register_handler` helper) to register tasks named `<slug>.<operation>`.
4. **Frontend (optional)** – add React panels under `frontend/index.tsx` for development and bundle an ESM entry at `frontend/dist/index.js`. The shell lazy-loads the dist file at runtime, injects shared dependencies through `window.__SRE_TOOLKIT_RUNTIME`, and makes the `tk-*` primitives available for instant theming.
5. **Package** – run `python toolkits/scripts/package_toolkit.py <path>` to validate the manifest and emit `<slug>_toolkit.zip`. Upload the archive via `POST /toolkits/install` or the UI form and flip the enable toggle. The installer unwraps the archive into `TOOLKIT_STORAGE_DIR/<slug>/` and exposes static assets at `/toolkit-assets/<slug>/…`.

> **Frontend bundling:** generate `frontend/dist/index.js` with your preferred build tool (Vite library mode, esbuild, webpack, etc.). Keep React, React DOM, and React Router external—micro-frontends rely on the shared globals injected via `window.__SRE_TOOLKIT_RUNTIME`. During development, bundled toolkits can fall back to `frontend/index.tsx` so Vite still provides transforms and hot reload.

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
    {"title": "ChatOps Bot", "body": "Run responders from the dashboard.", "link_href": "/toolkits/incident-bots"}
  ],
  "dashboard": { "module": "backend.dashboard", "callable": "build_context" }
}
```

## API quick reference

| Domain | Endpoints |
|--------|-----------|
| Health | `GET /health` |
| Dashboard | `GET /dashboard` |
| Jobs | `GET /jobs`, `GET /jobs/{id}`, `POST /jobs`, `POST /jobs/{id}/cancel` |
| Toolkits | `GET/POST /toolkits`, `GET/PUT/DELETE /toolkits/{slug}`, `POST /toolkits/{slug}/jobs`, `POST /toolkits/install`, `GET /toolkits/docs/getting-started` |
| Bundles | Toolkit routers are mounted automatically using metadata from `toolkit.json` |

## Configuration reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_ENV`, `APP_HOST`, `APP_PORT`, `LOG_LEVEL` | FastAPI runtime controls | see `.env.example` |
| `REDIS_URL` | Redis connection string for jobs & registry | `redis://redis:6379/0` |
| `REDIS_PREFIX` | Redis key prefix | `sretoolbox` |
| `TOOLKIT_STORAGE_DIR` | Filesystem directory for uploaded bundles | `./data/toolkits` |
| `FRONTEND_BASE_URL` | UI origin for auto-CORS | `http://localhost:5173` |
| `VITE_API_BASE_URL`, `VITE_API_PORT` | Frontend API discovery | `http://localhost:8080`, `8080` |
| `CORS_ORIGINS` | Optional comma-separated overrides | unset |
| `ZBX_BASE_URL`, `ZBX_TOKEN` | Legacy Zabbix defaults; UI-driven config preferred | unset |

## Contributing

- Keep assets ASCII-only unless the feature requires otherwise.
- Run your preferred linting/test commands before opening a PR (`ruff`/`black` for Python, `npm run build` for the frontend).
- Document new toolkits so operators understand how to deploy them safely.

> **Security note:** the bundled Zabbix Toolkit is developer-grade. Add authentication, audit logging, and request throttling before using it in production.
