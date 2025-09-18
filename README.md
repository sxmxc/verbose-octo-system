# SRE Toolbox

SRE Toolbox is an extensible operations workbench. It ships with a plug-in system called **toolkits** so SRE teams can drop in new integrations—runtime observability helpers, cloud APIs, internal runbooks—without redeploying the core stack.

```
┌─────────────┐    ┌────────────┐    ┌──────────────┐
│ React UI    │───▶│ FastAPI API│───▶│ Celery Worker│
└─────────────┘    └────────────┘    └──────────────┘
        ▲                ▲                   ▲
        │                │                   │
        │     Redis (jobs + toolkit registry)│
        └────────────────────────────────────┘
```

## Why teams use it
- **Toolkit-first architecture** – every integration is mounted at `/toolkits/<slug>`, can expose custom REST routes, enqueue background jobs, and optionally ship UI panels.
- **Job control plane** – jobs are tracked in Redis, executed by Celery, stream log lines, and support cancellation with partial-progress reporting.
- **Self-service registry** – administrators upload toolkit bundles (`.zip`), toggle visibility, and explore metadata directly from the UI.
- **Batteries included** – the Zabbix Toolkit illustrates multi-instance management and bulk host automation, while the Regex Toolkit offers a developer playground.

## Tech stack
- **Backend**: FastAPI, Redis, Celery. Toolkit metadata lives in Redis; uploaded bundles are persisted under `TOOLKIT_STORAGE_DIR`.
- **Worker**: Celery app (`worker/worker.py`) consuming `toolkit.operation` tasks.
- **Frontend**: React + Vite SPA with React Router and a dynamic sidebar sourced from the toolkit registry.
- **Packaging**: Docker Compose for API, worker, Redis, and UI containers.

## Quick start (Docker)
1. Copy `.env.example` to `.env`. Adjust `TOOLKIT_STORAGE_DIR` if you want bundles elsewhere.
2. `docker compose up --build`
3. Open the dashboard → `http://localhost:5173`; API docs → `http://localhost:8080/docs`

### Manual development workflow
```bash
# Backend API
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Celery worker
celery -A worker.worker.celery_app worker --loglevel=INFO

# Frontend UI
cd ../frontend
npm install
npm run dev
```

## Toolkit primer

| Component        | Purpose                                                      |
|------------------|--------------------------------------------------------------|
| `toolkit.json`   | Metadata: slug, name, version, backend/worker entrypoints, dashboard cards |
| `backend/`       | FastAPI routers mounted under `/toolkits/<slug>` (any Python package structure works – just point `backend.module` at it) |
| `worker/`        | Celery tasks keyed `<slug>.<operation>` for background work  |
| `frontend/` *(optional)* | React panels and assets surfaced by the UI              |

Bundle layout example:
```
incident-bots.zip
├── toolkit.json
├── backend/
│   └── app.py  (exposes `router`)
├── worker/
│   └── tasks.py (exposes `register(celery_app)`)
└── frontend/
    └── panels/
```

`toolkit.json` shape (minimum):

```json
{
  "slug": "incident-bots",
  "name": "Incident Bots",
  "description": "ChatOps responders",
  "backend": { "module": "backend.app", "router_attr": "router" },
  "worker": { "module": "worker.tasks", "register_attr": "register" },
  "dashboard_cards": [
    {"title": "ChatOps Bot", "body": "Run responders from the dashboard.", "link_href": "/toolkits/incident-bots"}
  ],
  "dashboard": { "module": "backend.dashboard", "callable": "build_context" }
}
```

Upload bundles with `POST /toolkits/install` (multipart: optional `slug`, required `file`). If you omit the slug, the value from `toolkit.json` is used. The bundle is extracted to `TOOLKIT_STORAGE_DIR/<slug>/`, metadata is persisted, and the toolkit becomes available in the UI—no edits to the core repo required.

Key manifest fields:

- `slug`: unique identifier (lowercase letters, numbers, `-`, `_`).
- `backend.module`: Python import path that exports an `APIRouter` (default attr `router`).
- `worker.module`: Python import path that exports a callable register function (default name `register`) receiving the shared Celery app.
- `dashboard_cards`: optional array of `{title, body, link_href?, link_text?, icon?}` used to surface cards on the global dashboard.
- `dashboard.module`/`dashboard.callable`: optional hook that returns metrics for the dashboard highlight card.

### Submitting jobs from a toolkit
Toolkits enqueue work through either the shared `/jobs` endpoint or the toolkit helper:

```
POST /toolkits/{slug}/jobs
  operation=<operation-name>
  payload=<JSON string or omit>
```

When a toolkit is enabled, SRE Toolbox automatically imports its backend router and calls the toolkit's worker registration function (default `register`). As long as your worker module defines tasks keyed `<slug>.<operation>`, the shared job runner will execute them and stream log lines back to the UI.

## Bundled toolkits

The repository ships with two reference toolkits located under `toolkits/bundled/`. They install automatically on the first bootstrap so you can explore the product experience immediately, yet they behave exactly like any other toolkit: you can disable or uninstall them, and the runtime will respect that choice on future starts.

- **Zabbix Toolkit – `/toolkits/zabbix`**: Manage multiple API endpoints, run connectivity tests via `apiinfo.version`, and bulk-import hosts through background jobs.
- **Regex Toolkit – `/toolkits/regex`**: Evaluate patterns with selectable flags and inspect numbered or named capture groups in real time.

## API surface (highlights)

| Area | Endpoints |
|------|-----------|
| Health | `GET /health` |
| Dashboard | `GET /dashboard` – recent jobs + toolkit metrics |
| Jobs | `GET /jobs` (filter by `toolkit=` or legacy `module=`), `GET /jobs/{id}`, `POST /jobs`, `POST /jobs/{id}/cancel` |
| Toolkits | `GET/POST /toolkits`, `GET/PUT/DELETE /toolkits/{slug}`, `POST /toolkits/{slug}/jobs`, `POST /toolkits/install`, `GET /toolkits/docs/getting-started` |
| Zabbix Toolkit | CRUD `/toolkits/zabbix/instances`, testing, bulk host actions |
| Regex Toolkit | `POST /toolkits/regex/test` |

## Job lifecycle
1. Toolkit enqueues a job (UI action or API call). Metadata is stored in Redis with `status=queued` and both `toolkit` and legacy `module` fields.
2. Celery worker processes the job, logging progress to `logs[]` and updating `progress`.
3. `/jobs` polls every five seconds; operators can cancel running jobs which transitions values through `cancelling` → `cancelled` with partial results retained.

## Configuration reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_ENV`, `APP_HOST`, `APP_PORT`, `LOG_LEVEL` | FastAPI runtime controls | see `.env.example` |
| `REDIS_URL` | Redis connection string for jobs & registry | `redis://redis:6379/0` |
| `REDIS_PREFIX` | Redis key prefix | `sretoolbox` |
| `TOOLKIT_STORAGE_DIR` | Filesystem directory for uploaded bundles | `./data/toolkits` |
| `FRONTEND_BASE_URL` | UI origin for CORS auto-configuration | `http://localhost:5173` |
| `VITE_API_BASE_URL`, `VITE_API_PORT` | Frontend API discovery | `http://localhost:8080`, `8080` |
| `CORS_ORIGINS` | Optional comma-separated origins override | unset |
| `ZBX_BASE_URL`, `ZBX_TOKEN` | Legacy Zabbix defaults; UI-driven config preferred | unset |

## Developing your own toolkit
1. **Scaffold**: create `toolkit.json` (slug, name, version, backend/worker entrypoints, dashboard cards).
2. **Backend**: write FastAPI routes (export an `APIRouter` attribute—default name `router`) that accept toolkit-specific requests; rely on shared utilities in `backend/app/core` when possible.
3. **Worker**: expose a callable (default `register`) that receives the Celery app and registers tasks keyed `<slug>.<operation>`.
4. **Frontend** (*optional*): add React panels; the Shell will surface them once the toolkit is enabled.
5. **Package**: zip the bundle, upload via `/toolkits/install`, enable via the UI, and confirm routes appear in `/toolkits/<slug>` and the sidebar (dashboard cards render automatically).
6. **Document**: extend `/toolkits/docs` if your toolkit needs extra onboarding steps.

## Admin UI walkthrough
- **Workspace** – dashboard, jobs table.
- **Toolkits** – “All toolkits” catalog + one entry per enabled toolkit (sorted alphabetically).
- **Administration → Toolkits** – toggle visibility, upload `.zip` bundles, uninstall custom toolkits, and review the quick-start summary.

## Roadmap & contributing
- Planned: bundle signature validation, runtime toolkit sandboxing, worker auto-discovery, and richer toolkit analytics.
- Contributions welcome—run `ruff` and `black` on Python code, keep assets ASCII-only unless explicitly required, and document new toolkits.

> **Note:** the bundled Zabbix Toolkit is demo-grade. Harden authentication, add audit logging, and implement rate limiting before running in production.
