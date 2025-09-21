# Contributing to SRE Toolbox

Thanks for helping us improve the SRE Toolbox. This guide applies to both humans and Codex-powered automation.

## Getting started

1. Fork the repository or create a feature branch from `main` (`feature/<short-description>`).
2. Keep your branch up to date by rebasing on `main` before opening a pull request.
3. Familiarise yourself with the architecture via `README.md`, `docs/toolbox-architecture.md`, and `docs/runtime-architecture.md`.
4. Review the backlog in `docs/TODO.yaml` and update `ai/state/progress.json` when you pick up work.

## Development workflow

- **Backend** – create a Python 3.11 virtual environment, install `backend/requirements.txt`, and run `uvicorn app.main:app --reload` for local testing.
- **Worker** – run `celery -A worker.worker:celery_app worker --loglevel=INFO` with the same virtual environment.
- **Frontend** – from `frontend/`, run `npm install` and `npm run dev -- --host 0.0.0.0 --port 5173`.
- **Containers** – `docker compose up --build` launches the full stack if you prefer an end-to-end environment.

## Code expectations

- Follow the [coding standards](docs/coding-standards.md) for Python, TypeScript, and documentation.
- Honour access control helpers (`RequireRole`, `RequireSuperuser`) and avoid widening permissions without review.
- Keep functions and components focused; refactor when files grow beyond a few hundred lines.
- Add or update unit tests that cover new behaviour (`pytest` for backend/worker, `npm test` for frontend).

## Documentation and state

- Operator-facing changes require updates under `frontend/documentation`.
- Internal workflows, architectural notes, and prompt guidance belong in `docs/` or `ai/ops/`.
- Maintain Codex state:
  - `docs/TODO.yaml` for backlog updates.
  - `ai/state/progress.json` for active focus and session metadata.
  - `ai/state/journal.md` for narrative summaries.
- When you add new processes or agent behaviours, extend `ai/ops/codex.md` so future sessions inherit the knowledge.

## Pull requests

- Use the template in `.github/PULL_REQUEST_TEMPLATE.md` when opening a PR. Fill in each checklist item or explain why it is not needed.
- Keep commits atomic and use imperative subject lines (`Add toolkit upload audit log`).
- Link related issues or TODO entries directly in the PR description.
- Summarise user-visible changes and mention required coordination (secrets, migrations, feature flags).

## Review process

- Expect reviewers to focus on security, observability, and UX alignment with `AppShell.tsx` routes.
- Automated checks (CI, linting, formatting) must pass before merge.
- Address feedback promptly; amend commits as needed but avoid rewriting shared history after reviews begin.

## Need help?

Open a discussion or ping the maintainers if you need access to Vault secrets, deployment environments, or additional context. For Codex-driven work, leave breadcrumbs in the journal so humans can assist mid-stream.
