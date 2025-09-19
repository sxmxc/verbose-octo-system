# Toolkit Build Workflow

Toolkits are portable. Teams often develop and release them outside the Toolbox repository, then hand the finished bundle to operators. Use this checklist to keep every toolkit consistent and ready for installation.

## 1. Prepare the directory

A toolkit directory must contain at least:

```
my-toolkit/
├── toolkit.json
├── backend/
├── worker/
└── frontend/
```

- `toolkit.json` declares the slug, name, and runtime entry points.
- `backend/` exposes FastAPI routers that will be mounted under `/toolkits/<slug>`.
- `worker/` registers Celery tasks using your slug as the prefix.
- `frontend/` hosts optional React source and the compiled distribution.

## 2. Build the frontend (optional)

If your toolkit ships a UI, generate an ESM bundle at the path referenced by `toolkit.json → frontend.entry` (default: `frontend/dist/index.js`). Toolkits can use any build tool as long as the output targets modern browsers and keeps `react`, `react-dom`, and `react-router-dom` external—the shell provides them at runtime.

## 3. Validate and package

Use the packaging utility checked into this repo to ensure required files exist before you distribute the bundle:

```bash
python toolkits/scripts/package_toolkit.py /path/to/my-toolkit
```

The script performs the following checks:

- `toolkit.json` is present and valid JSON.
- Files referenced by `frontend.entry` and `frontend.source_entry` exist.
- The default `frontend/dist/index.js` is present when no `frontend.entry` is declared.
- Ignores development build artefacts such as `node_modules/` and `.DS_Store`.

On success it creates `<slug>_toolkit.zip` alongside the toolkit directory (override with `--output`). Distribute that archive to operators or upload it through **Administration → Toolkits**.

## 4. Ship documentation

Include markdown in `frontend/documentation` that references your toolkit so it appears in the in-app documentation hub. Link to those guides from `toolkit.json → dashboard_cards` to give operators fast access.

## Tips

- Keep frontend bundles small: lazy-load heavy pages or embed them behind feature flags inside your toolkit.
- Version the toolkit directory with Git so you can reproduce releases and build deterministic archives.
- Automate packaging as part of CI by invoking the Python helper and uploading the resulting zip to your artifact store.

Return to the [Toolkit](toolkit) overview for more information about runtime expectations.
