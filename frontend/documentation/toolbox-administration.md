# Toolbox Administration

Use this guide to run the SRE Toolbox day to day. It covers the management screens exposed in the shell and the dependencies that must remain healthy (Vault, Redis, PostgreSQL, toolkit storage).

## Runtime at a glance

- **Dependencies** - The stack requires HashiCorp Vault, PostgreSQL, and Redis. If any component is unreachable, the Dashboard surfaces a status card and the API reports `503` on `/health`.
- **Toolkit storage** - Bundles live on the shared `toolbox-data` volume. Uploaded archives appear under Administration → Toolkits.
- **Audit trail** - All administrative actions (role changes, toolkit installs, auth-provider edits) write to the audit log available from Administration → Security.

## Enabling or disabling toolkits

1. Navigate to **Administration → Toolkits**.
2. Locate the toolkit card and review the metadata (version, description, origin).
3. Toggle the switch to enable or disable it. The change propagates immediately to the API and worker. If a toolkit fails to load, the UI displays the error surfaced by the worker import hook.
4. Use the "Open documentation" link to verify that operator guidance exists in `frontend/documentation`.

## Uploading a new toolkit

1. Package the bundle using `toolkits/scripts/package_toolkit.py` (see [Toolkit Build Workflow](toolkit-build)).
2. Open **Administration → Toolkits → Upload bundle**.
3. Provide the `.zip` file. The backend validates the slug, manifest, and file shapes before extracting the archive to `TOOLKIT_STORAGE_DIR`.
4. Enable the toolkit and confirm it registers a dashboard card or UI entry. If the worker reports an import error, check the worker logs and ensure the bundle paths match the manifest.

## Monitoring jobs

- Visit **Workspace → Jobs** to track running and completed Celery jobs. Filter by toolkit via the query parameter `?toolkit=<slug>`.
- Each row displays status, percent complete, timestamps, and the most recent log entry.
- Use the "Cancel" action to send a cancellation signal; toolkits receive the notification via Redis and should stop work cooperatively.

## Managing users and roles

- Navigate to **Administration → Users**.
- Invite operators with predefined roles. Typical combinations:
  - `toolkit.user` - run toolkits and view dashboards.
  - `toolkit.curator` - manage toolkit enablement and uploads.
  - `system.admin` - manage authentication providers, users, and audit exports.
- Role changes take effect immediately and are logged for auditing.

## Configuring authentication providers

1. Go to **Administration → Auth settings** (requires `system.admin`).
2. Add or edit providers (Local, OIDC, LDAP, Active Directory). Each form includes required fields and optional Vault-backed secret references.
3. Use the "Test connection" button to validate bind credentials or discovery endpoints before saving.
4. Provider changes are persisted in PostgreSQL and reflected in the login screen instantly.

## Validating Vault connectivity

- The status badge at the top of **Administration → Auth settings** shows whether Vault is reachable.
- If Vault becomes sealed or unavailable, toolkit secrets cannot be resolved and the API returns a `503`. Unseal Vault and refresh the page to restore connectivity.
- When rotating Vault tokens, update `.env` (or the secret backing `VAULT_TOKEN_FILE`) and restart the API/worker.

## Checking system health

- The **Dashboard** aggregates toolkit-supplied cards and core service health.
- `GET /health` returns `"status": "ok"` when the API can reach PostgreSQL, Redis, and Vault.
- Use the **Toolbox Health** bundled toolkit (if enabled) to view live status for the API, worker, and frontend.

Keep this guide handy during on-call rotations to ensure the shell, dependencies, and toolkits stay in sync.
