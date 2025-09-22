# Toolkit Authoring Overview

Use this guide as the starting point for building SRE Toolbox toolkits. It connects the runtime expectations baked into the App Shell, backend loader, and worker processes so every bundle installs cleanly and feels native to operators.

## Lifecycle at a Glance
- **Design** – capture the operator workflow, required roles, and dashboard touchpoints your toolkit must cover.
- **Scaffold** – follow the baseline directory structure (`toolkit.json`, `backend/`, `worker/`, `frontend/`).
- **Develop** – iterate locally with the Toolbox stack (`npm run dev`, `uvicorn`, `celery`) so your toolkit interacts with live APIs.
- **Document** – add guides to `frontend/documentation` so the in-app knowledge base reflects new capabilities.
- **Package & Release** – bundle with `toolkits/scripts/package_toolkit.py` and publish the resulting `<slug>_toolkit.zip` via Admin → Toolkits.

## Key Runtime Contracts
- `AppShell.tsx` injects `React`, `react-router-dom`, and `apiFetch` into `window.__SRE_TOOLKIT_RUNTIME`; avoid bundling those dependencies yourself.
- Toolkits render under `/toolkits/:slug/*`; unauthenticated users hit `/login` and role checks (`RequireRole`, `RequireSuperuser`) gate admin routes.
- `ToolkitRenderer` caches module imports per `toolkit.slug` and entry fields. Update `toolkit.updated_at` in `toolkit.json` when you want the shell to invalidate stale bundles.
- Failed imports log warnings (`Toolkit <slug> import failed ...`) and fall back to `GenericToolkitPlaceholder`. Design your toolkit UI to degrade gracefully and surface actionable error states.

## Slug Requirements
- Declare a slug in `toolkit.json`; values must be lowercase and can only include letters, numbers, hyphen (`-`), or underscore (`_`).
- The slug becomes the directory name under `TOOLKIT_STORAGE_DIR` and the namespace for dynamic imports. Invalid characters cause packaging and installation to fail before any files are written.

## Deliverables Checklist
- [ ] `toolkit.json` with backend, worker, catalog, and optional frontend metadata.
- [ ] FastAPI router exposing your public API surface.
- [ ] Celery registration for background jobs and job telemetry.
- [ ] Optional React bundle built as ESM and tested in both light/dark modes.
- [ ] Operator documentation and release notes.
- [ ] Automated tests for backend (`pytest`/`unittest`), worker tasks, and frontend (`vitest`).

## Roles & Permissions
- Declare expected roles in your design doc. The shell recognises `toolkit.curator` for toolkit admin tasks and `user.is_superuser` for auth changes (see `frontend/src/AppShell.tsx`).
- Toolkits should enforce additional RBAC inside their APIs when necessary; the shell provides only coarse routing guards.

Continue with the more detailed backend, frontend, and distribution guides in this folder.
