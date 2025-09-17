# Zabbix Admin Scaffold

This is a minimal scaffold for a **Zabbix Administration** app.

## Stack
- **Backend**: FastAPI (REST) + Celery worker (Redis broker) for background jobs.
- **Frontend**: React + Vite.
- **Packaging**: Docker Compose for local dev.

## Quick start (Docker)
1) Copy `.env.example` to `.env` and adjust values.
2) `docker compose up --build`
3) Open:
   - Backend API docs: http://localhost:8080/docs
   - Frontend: http://localhost:5173

## Without Docker
- Backend dev:
  ```bash
  cd backend
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn app.main:app --reload --port 8080
  ```
- Worker:
  ```bash
  cd backend
  celery -A worker.worker.celery_app worker --loglevel=INFO
  ```
- Frontend:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

## What’s included
- Auth placeholders (OIDC ready hook), RBAC hooks
- Job model & endpoints
- Example action: **Bulk Add Hosts** (dry-run only) → queues a background job
- Zabbix client stub with version adapters hook
- Basic React UI: Jobs list, submit Bulk Add dry-run

> ⚠️ This is a scaffold. You’ll need to implement real Zabbix logic, AuthN/Z, and harden approvals/guardrails.
