# Building the Latency Sleuth Toolkit

Latency Sleuth ships as an optional toolkit bundle. Build the frontend, commit the assets, and let CI produce the distributable archive.

1. Ensure `frontend/dist/index.js` is rebuilt from the latest source.
2. Commit the changes, open a pull request, and merge into `main`.
3. Download the `toolkit-latency-sleuth` artifact (containing `latency-sleuth_toolkit.zip`) from the Release workflow run or via `gh run download --repo <org>/<repo> --name toolkit-latency-sleuth`.

## Release Checklist
- Update `toolkit.json` with a bumped `version` and `updated_at` timestamp.
- Regenerate operator documentation after any SLA tuning or alerting workflow changes.
- Run backend (`pytest`), worker, and frontend (`vitest`) tests from this directory before merging.
- Confirm the Release workflow succeeded for `toolkit-latency-sleuth` and share the downloaded archive with operators.
- Capture noteworthy changes in your release notes so operators understand behavioural differences.
