# Security Hardening TODO

## Toolkit Upload & Execution
- [ ] Harden zip extraction in `backend/app/routes/toolkits.py` and `backend/app/toolkits/install_utils.py`:
  - Reject absolute/parent-path entries, symlinks, and dangerous filenames.
  - Stream uploads to disk and enforce per-file/total size limits to block zip bombs.
  - Copy artefacts with traversal-safe APIs (e.g. `copytree(..., dirs_exist_ok=True)` after validation).
- [ ] Validate toolkit slugs everywhere (manifest parsing, API input, CLI packagers) against a strict allowlist before using them in file paths or imports.
- [ ] Normalize uploaded filenames before persisting (strip directories, randomise collisions).
- [ ] Remove the resolved `bundle_path` from API responses to avoid leaking server layout.
- [ ] Investigate running toolkit build/test steps in an isolated workspace or container before activation.

## Authentication & Secrets
- [ ] Enforce non-default JWT secrets (or require configured asymmetric key pairs) during startup.
- [ ] Add `token_use` / `typ` assertions when refreshing tokens to prevent access-token replay.
- [ ] Implement login throttling / lockout for the local provider; emit audit logs on failed attempts.
- [ ] Keep access tokens out of `localStorage`; rely on httpOnly refresh cookies or in-memory storage on the SPA.

## Provider Secret Management
- [ ] Stand up a secrets manager (e.g. HashiCorp Vault running in its own container) for storing OIDC/LDAP credentials.
- [ ] Replace plain JSON storage of provider configs with references to Vault secrets; fetch at runtime via a Vault client.
- [ ] Document secret provisioning workflow for operators (Vault policies, rotations, bootstrap tokens).

## Infrastructure & Tooling
- [ ] Tighten `frontend/vite.config.ts` dev-server `fs.allow` list to the bare minimum.
- [ ] Remove default Postgres credentials from `docker-compose.yml` (force overrides or prompt at deploy time).
- [ ] Add automated tests covering malicious zip uploads, slug fuzzing, and toolkit activation edge cases.

## Job Orchestration
- [x] Update `/jobs` listing to keep toolkit and module filters separate so module-only queries return the correct jobs.

## Toolkit Worker Lifecycle
- [ ] Ensure `load_toolkit_workers` only records a slug as loaded after the worker module registers successfully, allowing retries when registration fails.

## Follow-up Questions / Planning
- [ ] Define the review/approval process for community-submitted toolkits before they reach production.
- [ ] Evaluate containerized Vault deployment options (official Vault Docker image with persistent storage + TLS) and integrate into docker-compose or orchestration stack.
