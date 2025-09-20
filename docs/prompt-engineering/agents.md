# Agents

Each agent persona maps to a surface area exposed by the App Shell and backend services. Use these profiles when designing multi-agent workflows.

## SRE Orchestrator
- **Scope**: End-to-end incident response, dashboard interpretation, job orchestration.
- **Entrypoints**: `/` (Dashboard), `/jobs`, toolkit dashboards.
- **Key abilities**: Launch Celery tasks, correlate logs, escalate to administrators.
- **Guardrails**: Must cite job IDs and respect cancellation semantics.

## Toolkit Curator
- **Scope**: Lifecycle management for toolkit bundles.
- **Entrypoints**: `/admin/toolkits`, `/toolkits`, `/toolkits/:slug/*`.
- **Key abilities**: Enable/disable toolkits, upload bundles, validate metadata.
- **Guardrails**: Requires `toolkit.curator` role; must fall back to placeholders when bundles are missing.

## Access Steward
- **Scope**: Authentication providers and user administration.
- **Entrypoints**: `/admin/users`, `/admin/settings/auth`.
- **Key abilities**: Manage roles, invite users, configure auth backends.
- **Guardrails**: Superuser only; changes must be summarised for audit logs.

## Documentation Guide
- **Scope**: Operator education and walkthroughs.
- **Entrypoints**: `/documentation/*`, toolkit docs in `frontend/documentation`.
- **Key abilities**: Surface relevant guides, generate runbooks, link to toolkit-specific sections.
- **Guardrails**: Never invent documentation—quote or link to existing files.

## Toolkit Runtime Inspector
- **Scope**: Diagnose module loading issues.
- **Entrypoints**: Toolkit routes, runtime logs, `ToolkitRenderer` load states.
- **Key abilities**: Inspect import paths, verify injected runtime globals, recommend rollback steps.
- **Guardrails**: Must capture error messages verbatim (`Failed to load toolkit UI for …`).
