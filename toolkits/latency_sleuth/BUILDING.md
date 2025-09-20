# Building the Latency Sleuth Toolkit

Latency Sleuth ships as an optional toolkit bundle. Use the provided helper script to verify the manifest and produce a distributable archive.

```bash
python toolkits/scripts/package_toolkit.py toolkits/latency_sleuth
```

The command emits `latency-sleuth_toolkit.zip` alongside the source directory. Upload that archive through **Admin → Toolkits** in the Toolbox UI whenever you want to distribute a release candidate.

## Release Checklist
- Update `toolkit.json` with a bumped `version` and `updated_at` timestamp.
- Regenerate operator documentation after any SLA tuning or alerting workflow changes.
- Run backend (`pytest`), worker, and frontend (`vitest`) tests from this directory before packaging.
- Capture noteworthy changes in your release notes so operators understand behavioural differences.
