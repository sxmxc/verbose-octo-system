# Codex Operations Codex

This playbook is the source of truth for long-running Codex automation inside the SRE Toolbox repository. Use it to decide what to work on next, capture state between sessions, and anchor any prompt engineering experiments.

## State management

Codex keeps its working memory on disk so follow-up sessions can resume without guesswork.

- `docs/TODO.yaml` holds the curated backlog. Update it whenever priorities shift or new findings emerge.
- `ai/state/progress.json` captures machine-readable progress snapshots (current focus, recently touched tasks, blockers).
- `ai/state/journal.md` is the human-readable timeline of sessions, experiments, and decisions.

**Workflow**

1. Read the backlog and pick the highest-value task that is unblocked.
2. Record the selected task inside `ai/state/progress.json` (`active_task`) and note why it was chosen.
3. Work the task. Update the journal with observations, intermediate artefacts, and next steps.
4. When the task lands, move it to `status: done` in `docs/TODO.yaml`, record lessons learned in the journal, and clear `active_task`.
5. Commit code and docs together, making sure CI instructions in `.github/PULL_REQUEST_TEMPLATE.md` are satisfied.

Always prefer editing these files over relying on memory. If a task spans multiple sessions, append to the existing journal entry instead of overwriting it.

## Operating principles

1. **Prime with architecture** – remind yourself of FastAPI, Celery, Redis, Vault, and the React App Shell when crafting prompts or validating behaviours.
2. **State outcomes clearly** – tie each change to observable metrics (API response, UI route, log entry) before moving on.
3. **Respect guardrails** – honour role gates (`toolkit.curator`, superuser) and cancellation semantics across toolkits and jobs.
4. **Surface context** – cite relevant routes or files (`AppShell.tsx`, toolkit manifests, `backend/app/toolkits/*`) in documentation updates and PRs.
5. **Close the loop** – summarise what changed, reference dashboards, and link to supporting docs in every journal or PR entry.

## Agent personas

Use these profiles when you need to reason about different operational perspectives or multi-agent flows.

| Persona | Scope | Entrypoints | Guardrails |
| --- | --- | --- | --- |
| **SRE Orchestrator** | Incident response, dashboards, job orchestration. | `/`, `/jobs`, toolkit dashboards. | Cite job IDs, respect cancellation semantics. |
| **Toolkit Curator** | Toolkit lifecycle management. | `/admin/toolkits`, `/toolkits`, `/toolkits/:slug/*`. | Requires `toolkit.curator`; use placeholders when bundles are missing. |
| **Access Steward** | Authentication providers and user admin. | `/admin/users`, `/admin/settings/auth`. | Superuser only; summarise changes for audit logs. |
| **Documentation Guide** | Operator education and runbooks. | `/documentation/*`, toolkit docs in `frontend/documentation`. | Quote existing docs; no speculative instructions. |
| **Toolkit Runtime Inspector** | Diagnose module loading issues. | Toolkit routes, runtime logs, `ToolkitRenderer` states. | Capture error messages verbatim (`Failed to load toolkit UI for …`). |

## Prompt design patterns

- Prime prompts with available toolkits, tenant state, and key environment variables (`VITE_API_BASE_URL`, `VITE_DEV_API_PROXY`, `FRONTEND_BASE_URL`, `TOOLKIT_STORAGE_DIR`).
- Reference the React shell and injected runtime globals (`window.__SRE_TOOLKIT_RUNTIME`) when discussing toolkit frontends.
- List safe commands, forbidden operations, and approval checkpoints whenever destructive actions are possible.
- Mirror operator journeys by citing the same routes rendered in `AppShell.tsx`.
- Encourage logging of Celery job IDs, Redis keys, and placeholder fallbacks so observability stays consistent.

## Prompt checklist

Before finalising a new or updated prompt:

- **Environment** – confirm authentication assumptions and required environment variables.
- **Roles** – state the roles needed (`toolkit.curator`, superuser) and fallback behaviour when they are missing.
- **Inputs** – define input formats, mandatory identifiers (toolkit slug, job ID, username), and validation rules.
- **Outputs** – describe success criteria (UI state, API response, log entry) and navigation targets.
- **Safety** – require confirmation for destructive actions, instruct agents to favour placeholders when toolkits fail to load, and log retries with specifiers (`local`/`remote`).
- **Observability** – direct agents to monitor Celery/Redis metrics and link to the Jobs page or runtime logs.

## Canonical task library

Use this library as inspiration when expanding the backlog or scoping a new session.

### Monitoring & response
- Review the dashboard (`/`) for degraded toolkit signals.
- Inspect `/jobs` for failed Celery tasks, capturing task ID, status, and log excerpts.
- Trigger retries or cancellations while confirming Redis state changes.

### Toolkit management
- Audit toolkits via `/toolkits` and flag disabled bundles.
- Enable or disable a toolkit, citing the slug and justification.
- Upload a toolkit bundle and verify that `ToolkitRenderer` resolves the new UI module.

### User & auth operations
- Add operators with predefined roles through `/admin/users`.
- Rotate authentication provider secrets under `/admin/settings/auth` and confirm session impact.

### Documentation support
- Recommend the correct guide from `frontend/documentation` given a query.
- Summarise toolkit-specific runbooks for handoffs.

### Runtime diagnostics
- Investigate toolkit load errors by comparing `local` vs `remote` module specifiers.
- Provide fallback instructions when the App Shell renders `GenericToolkitPlaceholder`.

## Extending the codex

When you introduce a new workflow or toolkit capability, add it here so future sessions inherit the knowledge. Reference PRs, documentation updates, and relevant code paths to keep this codex auditable.
