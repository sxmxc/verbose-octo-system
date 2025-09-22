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

## 3. Trigger automated packaging

The repository's **Release** workflow runs on every push to `main` and packages toolkits for you—no local zip step is required.

1. Commit the toolkit changes (including built assets such as `frontend/dist/index.js`) and open a pull request.
2. After approval, merge into `main`. The Release workflow detects every `toolkit.json` and runs `toolkits/scripts/package_all_toolkits.py` to build `<slug>_toolkit.zip` archives.
3. Monitor the run under **GitHub → Actions → Release**. Each toolkit appears as a `Package Toolkit (<slug>)` job.
4. Download the resulting artifact named `toolkit-<slug>` from the workflow summary, or fetch it via the CLI:

   ```bash
   gh run download --repo <org>/<repo> --name toolkit-<slug> --dir dist
   ```

5. Share the downloaded archive with operators or upload it through **Administration → Toolkits** once you're ready to deploy.

The workflow enforces the same validations as the historical helper script: manifest syntax, slug allowlists, required frontend entries, and filesystem safety guards.

## 4. Ship documentation

Include markdown in `frontend/documentation` that references your toolkit so it appears in the in-app documentation hub. Link to those guides from `toolkit.json → dashboard_cards` to give operators fast access.

## Tips

- Keep frontend bundles small: lazy-load heavy pages or embed them behind feature flags inside your toolkit.
- Version the toolkit directory with Git so you can reproduce releases and build deterministic archives.
- Use the Release workflow artifacts as your source of truth—archive them in your artifact store if you need longer retention than GitHub Actions provides.

Return to the [Toolkit](toolkit) overview for more information about runtime expectations.
