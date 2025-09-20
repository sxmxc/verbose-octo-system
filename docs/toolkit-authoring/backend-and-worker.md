# Backend & Worker Guide

Build your toolkit services so they plug into the FastAPI control plane and Celery worker without leaking implementation details or conflicting with other bundles.

## FastAPI Surface
- Create a module (e.g. `backend/app.py`) that exposes an `APIRouter` instance. Reference it in `toolkit.json → backend.module` and `backend.router_attr` (defaults to `router`).
- Namespace endpoints under your slug to avoid collisions: `/toolkits/<slug>/...` is automatically prefixed when the loader mounts your router.
- Use dependency injection for configuration (`Depends(get_settings)`) and keep secrets in environment variables or the toolkit metadata store.
- Return Pydantic models for structured responses; toolbox clients expect JSON.
- Raise `HTTPException` with descriptive error messages. The shell surfaces these in `ToolkitRenderer` error overlays and the Jobs page.

## Celery Workers
- Provide a module (e.g. `worker/tasks.py`) with a `register(celery_app)` callable or reference `worker.register_attr` in `toolkit.json`.
- Register tasks using the slug prefix (`@celery_app.task(name="<slug>.<action>")`) so operators can filter entries on the Jobs page.
- Emit progress updates to Redis for long-running jobs. The Toolbox job monitor expects log lines and status transitions to flow through Redis keys.
- Handle cancellations by periodically checking the Redis cancellation flag that the shell toggles when operators stop a job.

## Shared Utilities
- Use the shared `apiFetch` contract from the frontend or provide an equivalent client for backend-to-backend calls.
- Reuse existing settings helpers from the Toolbox back end when integrating with common providers (e.g. SQLAlchemy sessions, Redis client factories).

## Testing
- Add unit tests under your toolkit directory (`backend/tests/`, `worker/tests/`).
- Mock external services; do not assume Docker Compose services exist during CI.
- Validate Celery registration in tests by importing your `register` function into a fake Celery app and asserting that tasks are bound.

## Versioning & Migrations
- If your toolkit introduces database schema, ship Alembic migrations within the toolkit and expose a setup command invoked during installation.
- Bump a toolkit-specific semantic version in `toolkit.json` and include it in release notes so operators know which bundle they installed.

Continue with the frontend integration guide to wire operator experiences to these services.
