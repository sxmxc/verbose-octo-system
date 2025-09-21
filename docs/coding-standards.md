# Coding Standards

These conventions keep the SRE Toolbox codebase consistent across the FastAPI backend, Celery worker, and React frontend.

## General
- Default to TypeScript/ES2020 and Python 3.11+ language features that are supported by the toolchain.
- Prefer explicit imports; avoid wildcard imports outside `__init__.py` modules.
- Keep functions small and composable. If a component exceeds ~200 lines, look for opportunities to split responsibilities.
- Co-locate tests beside the code (`frontend/src/__tests__`, backend `tests/`) and update snapshots when behaviour changes.

## TypeScript & React
- Use function components with hooks; avoid legacy class components.
- Co-locate styles with components when using inline CSS objects (as in `AppShell.tsx`), but prefer CSS modules for larger style sets.
- Type all props and state explicitly. Lean on discriminated unions for complex flows instead of `any`.
- When routing, centralise path definitions in components like `AppShell.tsx` to keep navigation declarative.
- Use `apiFetch` wrapper for API calls so authentication headers and error handling stay consistent.

## Python Backend
- Structure FastAPI routers under `backend/app` and expose them via explicit `APIRouter` instances.
- New Celery tasks should live near the toolkit or domain logic that triggers them and adopt `slug.operation` naming.
- Use Pydantic models for request/response validation; keep response models in `schemas.py` modules.
- Follow Black (line length 88) and isort formatting. Re-run `make fmt` (or the equivalent script) before committing.

## Documentation & Prompts
- Place operator-facing docs under `frontend/documentation` (rendered by the UI).
- Store internal engineering guides under `docs/` and Codex playbooks under `ai/ops/`.
- Reference role gates (`toolkit.curator`, superuser) and toolkit lifecycle terminology consistently across documentation.
