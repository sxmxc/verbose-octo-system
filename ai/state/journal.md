# Codex Journal

Track Codex sessions chronologically. Each entry should capture what was attempted, what landed, and which TODO items changed.

## 2024-05-30 Setup
- Established persistent state files (`docs/TODO.yaml`, `ai/state/progress.json`, `ai/state/journal.md`).
- Consolidated prompt engineering guidance into `ai/ops/codex.md` so future sessions share the same playbook.
- Pending work: pick an item from the backlog and record it under `active_task` when execution begins.

## 2025-09-21 API Checker layout refresh
- Closed TODO `improve-design` by implementing the two-column layout requested in `docs/TODO.yaml` notes (Context7 #1).
- Added a collapsible history panel beneath the response area so history stays accessible without dominating the UI (Context7 #2).
- Updated `ai/state/progress.json` and `docs/TODO.yaml` to record completion and ready the next session (Context7 #3).

## 2025-09-21 Codex architecture docs refresh
- Authored `docs/toolbox-architecture.md` to describe component responsibilities and cross-runtime flows, and paired it with the existing runtime infrastructure guide.
- Captured database and payload relationships in `docs/toolbox-schema.md` so Codex prompts stay aligned with the persistent model.
- Updated `ai/ops/codex.md`, `ai/context/context7.md`, `AGENTS.md`, `docs/README.md`, `docs/runtime-architecture.md`, and `CONTRIBUTING.md` to reference the new docs and removed obsolete scoring/correlation steps.
