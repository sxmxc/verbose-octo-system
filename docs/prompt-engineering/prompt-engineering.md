# Prompt Engineering Playbook

This playbook captures how we craft instructions for SRE Toolbox automations and conversational agents. Use it as the canonical reference whenever you design user-facing prompts, system instructions, or evaluation criteria for new toolkits.

## Goals

- Align agent behaviour with SRE Toolbox architecture (FastAPI control plane, Celery jobs, React App Shell, toolkit bundles).
- Ensure prompts are reproducible, auditable, and traceable back to product requirements.
- Minimise risk by constraining agents to least-privilege actions and validated data sources.

## Principles

1. **Prime with context** – remind the agent about available toolkits, current tenant state, and relevant environment variables (`VITE_API_BASE_URL`, `VITE_DEV_API_PROXY`, `FRONTEND_BASE_URL`, `TOOLKIT_STORAGE_DIR`, etc.).
2. **State the desired outcome** – describe the measurable end state (e.g. "Celery job succeeds and log contains \"Synced 42 hosts\"").
3. **Enumerate guardrails** – list safe commands, forbidden operations, approval checkpoints, and observability hooks.
4. **Reference UI affordances** – quote route paths rendered by `AppShell.tsx` (`/jobs`, `/toolkits/:slug/*`, Admin sections) so the agent mirrors the operator journey.
5. **Balance determinism and flexibility** – prefer structured bullets, but allow free-form reasoning when toolkits expose exploratory workflows.
6. **Close the loop** – ask the agent to summarise what changed (Toolkit metadata updates, job IDs launched) and link to dashboards or documentation.

## Prompt Skeleton

```
System: You are the <agent role>. You can access toolkits: <slug list>. Stay within SRE Toolbox policies.
User: <Operator request / incident statement>
Assistant: <Step-by-step plan referencing relevant routes or API endpoints>
Validator: <Optional auto-check instructions, e.g. call /jobs/:id/logs>
```

Adapt the skeleton by expanding the system or validator blocks for higher-risk automations.

## Handling Toolkits

- When a toolkit ships a React frontend (`frontend/dist/index.js`), remind the agent that the App Shell injects `React`, `React Router`, and `apiFetch` via `window.__SRE_TOOLKIT_RUNTIME`.
- For toolkits without UI, guide the agent toward `/admin/toolkits` actions or documentation pages registered under `/documentation/*`.
- Use `GenericToolkitPlaceholder` language when communicating that a UI bundle is missing or disabled.

## Observability

- Encourage agents to surface Celery task IDs and Redis job keys.
- Reference `Jobs` page polling intervals and the expectation that cancellations propagate via Redis.
- Instruct agents to log fetch failures with the same phrasing used in `ToolkitRenderer` (`Failed to load toolkit UI for <slug>`).

## Security and Safety

- Require explicit approval before enabling toolkits or editing Auth settings (mirrors the `RequireRole` and `RequireSuperuser` wrappers in `AppShell.tsx`).
- Remind agents that unauthenticated users are redirected to `/login`, so prompts should always assume an authenticated session or request credentials first.
- Document how to fail closed when remote modules cannot be imported—fallback to placeholders and raise actionable error messages.

## Versioning

Store prompt iterations alongside toolkit versions. Update this playbook whenever routes, roles, or runtime injection points change in `AppShell.tsx`.
