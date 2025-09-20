# Task Library

Curate prompts around these canonical operator tasks. Link back to this list when authoring requirements or evaluations.

## Monitoring & Response
- Review the Dashboard (`/`) for degraded toolkit signals.
- Inspect `Jobs` for failed Celery tasks; capture task ID, status, and log excerpts.
- Trigger retries or cancellations, confirming Redis state changes.

## Toolkit Management
- Audit all toolkits via `/toolkits` and flag disabled bundles.
- Enable or disable a specific toolkit, citing the slug and justification.
- Upload a toolkit bundle and verify that `ToolkitRenderer` resolves the new UI module.

## User & Auth Operations
- Add a new operator with predefined roles via `/admin/users`.
- Rotate authentication provider secrets under `/admin/settings/auth` and confirm session impact.

## Documentation Support
- Recommend the correct guide from `frontend/documentation` given a user query.
- Summarise toolkit-specific runbooks for on-call handoffs.

## Runtime Diagnostics
- Investigate toolkit load errors by comparing local vs remote module specifiers.
- Surface actionable fallback instructions when the App Shell renders `GenericToolkitPlaceholder`.
