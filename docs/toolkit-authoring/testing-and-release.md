# Testing & Release Checklist

Follow this sequence before publishing a toolkit bundle so operators receive a reliable, observable experience.

## Automated Testing
- **Backend**: run `pytest` (or your toolkit’s equivalent) covering routers, services, and permission checks.
- **Worker**: simulate Celery tasks against a test app; assert that cancellation hooks and Redis telemetry behave as expected.
- **Frontend**: run `npm test` / `vitest` for components and hooks. Snapshot key screens to catch regressions in shell styling.
- **Integration**: execute smoke tests against a running Toolbox instance (local or staging) to validate cross-service flows.

## Manual Verification
- Install the bundle via Admin → Toolkits and ensure enable/disable toggles reflect the expected state.
- Visit `/toolkits/<slug>` to confirm the UI loads; inspect the browser console for import warnings from `ToolkitRenderer`.
- Trigger representative jobs and observe them in `/jobs` for accurate status transitions and logs.
- Validate documentation links in your toolkit dashboard cards open the intended guides in `/documentation/*`.

## Packaging & Distribution
- Build the frontend bundle (when applicable) so artifacts such as `frontend/dist/index.js` or custom `frontend.entry` targets exist before you commit.
- Verify the slug in `toolkit.json` uses only lowercase letters, numbers, hyphen (`-`), or underscore (`_`); the release workflow fails quickly when the allowlist is violated.
- Bump the toolkit version in `toolkit.json` and include a changelog entry summarising major changes and migration steps.
- Merge your branch (with built assets committed) into `main`. The **Release** GitHub Actions workflow runs on every push to `main`, invokes `toolkits/scripts/package_all_toolkits.py`, and uploads a `toolkit-<slug>` artifact containing `<slug>_toolkit.zip`.
- Monitor the workflow under **Actions → Release**. You can download artifacts directly from the run summary or via `gh run download --repo <org>/<repo> --name toolkit-<slug>` once the `Package Toolkit` job succeeds.
- Share the downloaded archive alongside release notes in your preferred artifact store, or hand it to the operations team for installation.
- Ensure the archive remains within the enforced limits (`TOOLKIT_UPLOAD_MAX_BYTES` compressed, `TOOLKIT_BUNDLE_MAX_BYTES` total extracted, `TOOLKIT_BUNDLE_MAX_FILE_BYTES` per file). The packaging job fails if these limits are exceeded or if prohibited paths (absolute, parent-directory segments, symlinks) appear.

## Rollback Strategy
- Keep the previous release bundle available so operators can reinstall quickly if issues arise.
- Document known downgrade caveats (e.g. database migrations) in the release notes.

## Post-Release Monitoring
- Watch Redis job telemetry, Celery worker logs, and frontend analytics for anomalies during the first deployment window.
- Capture lessons learned in an ADR or follow-up doc and link it from this folder to inform future toolkit authors.
