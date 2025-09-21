# Contributing Guide

> **Heads-up:** The canonical contribution process now lives at [`CONTRIBUTING.md`](../CONTRIBUTING.md). This file captures a quick reference for engineering teams who prefer docs under `docs/`.

## Branching
- Fork or create feature branches from `main` (`feature/<short-description>`).
- Rebase onto the latest `main` before opening a PR to keep the history linear.

## Commit Style
- Write imperative commit messages (e.g. `Add toolkit upload audit log`).
- Group related changes into a single commit; avoid "WIP" commits in shared branches.

## Code Review Checklist
- Tests: add or update unit/integration coverage for new behaviour.
- Security: respect role checks (`RequireRole`, `RequireSuperuser`) and avoid widening permissions unintentionally.
- Observability: log meaningful errors, especially around dynamic toolkit loading (`ToolkitRenderer`).
- UX: keep routes and copy consistent with `AppShell.tsx` navigation.

## Testing Matrix
- `npm test` for frontend unit tests.
- `pytest` (or the appropriate backend test runner) for FastAPI and worker coverage.
- Optional: run `docker compose up --build` to validate end-to-end interactions before merging.

## Documentation
- Update `frontend/documentation` for operator-facing changes that appear in the UI.
- Update `docs/` for internal processes (standards, architecture decisions) and `ai/ops/` for Codex playbooks.

## Release Notes
- Summarise user-visible changes in the PR description.
- Tag toolkit authors and operations stakeholders if a change affects bundled toolkits or runtime behaviour.
