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
- Run `python toolkits/scripts/package_toolkit.py <path>` to build `<slug>_toolkit.zip`.
- Include the generated archive and release notes in your artifact store (GitHub Releases, internal registry, etc.).
- Bump the toolkit version in `toolkit.json` and include a changelog entry summarising major changes and migration steps.
- Ensure the archive does not contain absolute paths, drive letters, parent-directory segments, or symlinks—uploads are rejected when these appear to prevent directory traversal during install.

## Rollback Strategy
- Keep the previous release bundle available so operators can reinstall quickly if issues arise.
- Document known downgrade caveats (e.g. database migrations) in the release notes.

## Post-Release Monitoring
- Watch Redis job telemetry, Celery worker logs, and frontend analytics for anomalies during the first deployment window.
- Capture lessons learned in an ADR or follow-up doc and link it from this folder to inform future toolkit authors.
