# AGENTS

**Source of Truth**  
- Master agent prompt: `ai/ops/codex.md`  
- Architecture reference: `docs/toolbox-architecture.md` (pair with `docs/runtime-architecture.md`)  
- Schema reference: `docs/toolbox-schema.md`  
- Task list: `docs/TODO.yaml`  
- Machine state: `ai/state/progress.json`  
- Journal: `ai/state/journal.md`

**Agents**
- **codex (work orchestrator):** Reads context, uses context7 mcp, selects next task from `docs/TODO.yaml`, updates state + journal each session.

**Run Loop (every session)**
1. Read: `docs/toolbox-architecture.md`, `docs/runtime-architecture.md`, `docs/toolbox-schema.md`, `ai/context/context.md`, `docs/TODO.yaml`, `ai/state/progress.json`, `ai/state/journal.md`.  
2. Pick highest-priority task with no unmet deps.  
3. Plan ≤500-line PR, test-first.  
4. Implement.
5. Update `docs/TODO.yaml`, `ai/state/progress.json`, `ai/state/journal.md`; open PR.
6. Provide branch name. Commit message. And the PR details following contribution and pr standards. Provide PR details in copyable MD form.

> Canonical content lives in `ai/ops/codex.md`. Update that file only; this page is a directory.
