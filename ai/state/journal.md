# Codex Journal

Track Codex sessions chronologically. Each entry should capture what was attempted, what landed, and which TODO items changed.

## 2024-05-30 Setup
- Established persistent state files (`docs/TODO.yaml`, `ai/state/progress.json`, `ai/state/journal.md`).
- Consolidated prompt engineering guidance into `ai/ops/codex.md` so future sessions share the same playbook.
- Pending work: pick an item from the backlog and record it under `active_task` when execution begins.

## 2025-09-21 API Checker layout refresh
- Closed TODO `improve-design` by implementing the two-column layout requested in `docs/TODO.yaml` notes (Context #1).
- Added a collapsible history panel beneath the response area so history stays accessible without dominating the UI (Context #2).
- Updated `ai/state/progress.json` and `docs/TODO.yaml` to record completion and ready the next session (Context #3).

## 2025-09-21 Codex architecture docs refresh
- Authored `docs/toolbox-architecture.md` to describe component responsibilities and cross-runtime flows, and paired it with the existing runtime infrastructure guide.
- Captured database and payload relationships in `docs/toolbox-schema.md` so Codex prompts stay aligned with the persistent model.
- Updated `ai/ops/codex.md`, `ai/context/context.md`, `AGENTS.md`, `docs/README.md`, `docs/runtime-architecture.md`, and `CONTRIBUTING.md` to reference the new docs and removed obsolete scoring/correlation steps.

## 2025-09-21 JWT secret enforcement
- Implemented `Settings._validate_jwt_settings` to reject placeholder, short, or missing secrets while requiring key pairs for RS/ES algorithms (`backend/app/config.py`; Context #2, #5).
- Added unit coverage that reloads settings with different env permutations to confirm the new validation paths (`backend/tests/test_config.py`; Context #6).
- Updated operator docs and `.env.example` so the enforced requirements are explicit for future sessions (`README.md`, `docs/project-setup.md`, `docs/runtime-architecture.md`, `frontend/documentation/toolbox-auth-architecture.md`; Context #7).

## 2025-09-21 Stack bootstrap automation
- Authored `bootstrap-stack.sh` to start Docker Compose dependencies, initialise Vault once, and skip any steps that were previously completed.
- Persisted generated unseal keys and root tokens without overwriting existing material, and ensured placeholder Vault secrets are seeded only when absent.
- Refreshed `.gitignore`, `README.md`, `docs/project-setup.md`, and `docs/runtime-architecture.md` to document the new helper and point operators at the automated flow.

## 2025-09-21 Latency Sleuth pagination
- Closed TODO `recent-runs-pagination` by introducing client-side pagination with a load-more footer in the Job Logs tab (`toolkits/latency_sleuth/frontend/components/JobLogViewer.tsx`; Context7 #1, #7).
- Added a reusable `usePaginatedJobs` hook and accompanying Vitest coverage to guard pagination resets and page growth (`toolkits/latency_sleuth/frontend/hooks`; Context7 #6).
- Ran the targeted Vitest suite via the toolkit-specific config to confirm the new hook behaviour before PR prep (`toolkits/latency_sleuth/frontend/vitest.config.mts`; Context7 #6).

## 2025-09-21 Community repository scaffold
- Focused on TODO `public-repo-setup`, creating a zipped starter repository with governance docs, automation scripts, and sample toolkit.
- Packaged artifact `toolkit-community-repo.zip` for maintainers to publish in a dedicated repo without modifying the main codebase.
- Updated TODO and progress tracking to reflect completion and provide follow-up context for discovery and versioning tasks.

## 2025-09-21 Latency Sleuth designer overhaul
- Closed TODO `improve-designer-tab` by reshaping the Probe Designer view into a responsive two-column layout with inline catalog actions (`toolkits/latency_sleuth/frontend/components/ProbeDesigner.tsx`; Context7 #1, #7).
- Added a reusable filtering helper with Vitest coverage to guarantee deterministic search/tag behaviour (`toolkits/latency_sleuth/frontend/components/filterProbeTemplates.ts`, `toolkits/latency_sleuth/frontend/components/__tests__/filterProbeTemplates.test.tsx`; Context7 #6).
- Ran the Latency Sleuth frontend Vitest config directly via the repository toolchain to confirm the suite stays green (`toolkits/latency_sleuth/frontend/vitest.config.mts`; Context7 #6).

## 2025-09-21 Postgres credential hardening
- Moved TODO `remove-default-postgres-creds` to in_progress and stripped docker-compose defaults so Postgres credentials must be supplied explicitly (`docs/TODO.yaml`, `docker-compose.yml`).
- Refreshed `.env.example`, the manual dev workflow, and the Docker Compose checklist so operators generate their own secrets before booting the stack (`.env.example`, `README.md`, `docs/project-setup.md`).
- Rendered the compose config with the updated `.env` to confirm required variables behave as expected (`docker compose config`; `docker-compose.yml`).

## 2025-09-21 Postgres bootstrap validation
- Closed TODO `remove-default-postgres-creds` by wiring a new env preflight into `bootstrap-stack.sh` that rejects placeholder Postgres credentials before Docker services launch (`backend/app/core/postgres_env.py`, `bootstrap-stack.sh`; Context: docs/TODO.yaml).
- Added pytest coverage to lock the validator’s behaviour around placeholders, mismatched `DATABASE_URL` values, and minimum password length (`backend/tests/test_postgres_env.py`; Context: backend tests).
- Refreshed onboarding docs and `.env.example` so operators have to replace every Postgres placeholder before running the helper (`README.md`, `docs/project-setup.md`, `.env.example`; Context: onboarding docs).

## 2025-09-22 API Checker error messaging refresh
- Tackled TODO `enhance-error-messages` by introducing a dedicated `formatApiError` helper with Vitest coverage so toolkit UIs surface backend detail and network guidance (`toolkits/api_checker/frontend/errorUtils.ts`, `toolkits/api_checker/frontend/__tests__/errorUtils.test.ts`; Context: docs/TODO.yaml).
- Updated the API Checker request flow to reuse the helper for request failures and history entries, ensuring operators see concise status-aware copy (`toolkits/api_checker/frontend/index.tsx`; Context: SRE Toolbox frontend runtime).
- Added a toolkit-local Vitest config to make the new tests repeatable via the shared React dependencies (`toolkits/api_checker/frontend/vitest.config.mts`; Context: toolkit testing guidance).
