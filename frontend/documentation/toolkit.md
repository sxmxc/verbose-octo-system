# Toolkit

Toolkits combine backend services, worker tasks, and optional frontend modules into a single distributable bundle. Use this primer to understand how each layer collaborates with the SRE Toolbox runtime.

## Filesystem Layout

```
toolkit/
├── backend/
├── worker/
├── frontend/
└── toolkit.json
```

- `backend/`: FastAPI routes, data models, and service helpers.
- `worker/`: Celery tasks and long-running jobs.
- `frontend/`: React bundle exported as source (`frontend/index.tsx`) or a compiled distribution (`frontend/dist/index.js`).
- `toolkit.json`: Metadata describing the toolkit name, slug, and runtime entry points.

## Backend Runtime

1. **Routes** – Register FastAPI routers in `backend/routes.py`. Use dependency injection to share authentication and clients.
2. **Services** – Place shared helpers in `backend/services/` so tasks and routes import the same business logic.
3. **Dashboard hooks** – Populate `toolkit.json → dashboard_cards` and the optional `dashboard` block so the shell surfaces high-value summaries.

## Worker Integration

Visit the [Worker](worker) guide for deeper coverage. At a glance:

- Tasks live under `worker/tasks.py` and should be idempotent so they can be retried safely.
- Emit progress updates via `TaskProgress` so jobs appear in the global dashboard.
- Use `apiFetch` from the frontend or CLI scripts to enqueue work through `/jobs`.

## Frontend Bundle

See the [UI](ui) reference for a full tour. Highlights:

- `frontend/index.tsx` registers routes beneath the toolkit slug.
- `frontend/runtime.ts` bridges the host shell runtime helpers.
- Use React Router for nested pages and Material Symbols for icons to match the shell.

## Packaging Checklist

Follow the [Toolkit Build Workflow](toolkit-build) for a detailed walkthrough. In short:

1. Build the frontend bundle (if applicable) so it matches `toolkit.json → frontend.entry`—for example, ensure `frontend/dist/index.js` exists.
2. Commit the generated assets alongside your code changes and merge into `main`.
3. Watch the **Release** workflow under GitHub Actions. It packages each toolkit automatically and publishes a `toolkit-<slug>` artifact containing `<slug>_toolkit.zip`.
4. Download the artifact from the workflow run (or via `gh run download`) and install it through `/toolkits/install` or the Admin → Toolkits UI.
5. Enable the toolkit to register routes, worker tasks, and frontend contributions once the new bundle is uploaded.

## Suggested Workflow

1. Create a Celery task in `worker/tasks.py` that integrates with your system of record.
2. Expose an HTTP endpoint in `backend/routes.py` that validates input and enqueues the task.
3. Build a UI surface under `frontend/pages/` to trigger the endpoint and stream job progress.
4. Document the runtime requirements in this directory so operators know how to configure and operate the toolkit.

Continue with the [Worker](worker) and [UI](ui) guides for implementation details.
