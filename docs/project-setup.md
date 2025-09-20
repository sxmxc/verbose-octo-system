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
2. Run `docker compose up --build` from the repo root.
3. Visit:
   - UI → http://localhost:5173
   - API docs → http://localhost:8080/docs

## Toolkit Storage
- Bundled toolkits install on first boot under `TOOLKIT_STORAGE_DIR` (defaults to `./data/toolkits`).
- Upload additional bundles from Admin → Toolkits or via `POST /toolkits/install`.
- Toolkit uploads are capped by `TOOLKIT_UPLOAD_MAX_BYTES` (compressed size) and unpacking safeguards `TOOLKIT_BUNDLE_MAX_BYTES` / `TOOLKIT_BUNDLE_MAX_FILE_BYTES` to block zip bombs; tweak these in `.env` when needed.
- Uploaded bundle filenames are normalised—directory segments are stripped and collisions gain a random suffix before the artefact is persisted.
