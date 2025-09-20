# Prompt Requirements

Use this checklist before publishing a new or updated prompt for SRE Toolbox agents.

## Environment Assumptions
- Operator is authenticated; otherwise redirect to `/login`.
- `API_BASE_URL` and `VITE_API_BASE_URL` are set and reachable.
- Relevant toolkits are installed and enabled (verify through `/admin/toolkits`).

## Role Mapping
- Declare required roles: `toolkit.curator` for toolkit administration, superuser for auth settings.
- Provide fallbacks when the operator lacks roles (route them to documentation or capture approval).

## Input Format
- Specify structured inputs (JSON, form fields, natural language) and how they map to API payloads.
- Capture mandatory identifiers (toolkit slug, job ID, username) and validation rules.

## Output Expectations
- Define success criteria (UI state, API response code, log entry).
- Require explicit mention of navigation targets rendered in `AppShell.tsx`.
- Request closing summaries that reference dashboards, jobs, or documentation pages.

## Safety
- For destructive actions (disabling toolkits, editing auth providers), require confirmation tokens or multi-step prompts.
- Instruct agents to use placeholders when toolkits fail to load instead of retrying indefinitely.
- Log any automatic retries, including specifier (`local`/`remote`) attempts captured in `loadToolkitModule`.

## Observability
- Include guidance to monitor Celery/Redis metrics and link to the `Jobs` page for real-time updates.
- When applicable, instruct agents to surface backend errors that correspond to frontend placeholders.
