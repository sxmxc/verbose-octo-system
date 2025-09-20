# Frontend Integration Guide

Craft the operator-facing portion of your toolkit so it plays nicely with the App Shell and the shared theming/runtime helpers.

## Runtime Context
- The shell injects `React`, `react-router-dom`, and `apiFetch` through `window.__SRE_TOOLKIT_RUNTIME`; mark them as externals in your bundler.
- Inline `toolkitPrimitives.css` classes are available (`tk-card`, `tk-button`, `tk-input`, etc.) and already respect theme variables managed in `ThemeContext`.
- Routes mount under `/toolkits/<slug>/*`; use nested routes to break large flows into smaller surfaces.

## Entry Points
- Point `toolkit.json → frontend.entry` to your bundled ESM file (default `frontend/dist/index.js`).
- During development, set `frontend.source_entry` to something like `frontend/index.tsx` so `AppShell.tsx` loads the local module when `import.meta.env.DEV` and `origin === 'bundled'`.
- Update `toolkit.json → frontend.updated_at` (or equivalent metadata field) when you ship a new bundle so `ToolkitRenderer` invalidates the cache.

## UX Expectations
- Match the spacing, typography, and iconography used in the shell (see `layoutStyles` and `SidebarSection` in `AppShell.tsx`).
- Provide empty, loading, and error states. When your bundle fails, the shell swaps in `GenericToolkitPlaceholder`; reuse its language in your own UI for consistency.
- Link back to core routes (`/jobs`, `/toolkits`, `/documentation/*`) so operators can jump between surfaces.

## Data Fetching & Jobs
- Use `apiFetch` for REST calls; it already includes authentication headers and base URL from `API_BASE_URL`.
- Surface job IDs and statuses returned by your backend so operators can pivot into the Jobs page.
- For streaming or polling, reuse the job polling cadence exposed elsewhere in the shell (e.g. ~2s for high-frequency updates).

## Local Development Workflow
- Run the Toolbox stack locally (`npm run dev` in `frontend`, `uvicorn` for the API, `celery` worker) and point your toolkit at those endpoints.
- When using Vite, configure aliasing to match the deployed bundle path so imports remain stable between dev and prod.
- Validate both light and dark themes using the shell’s theme toggle or by toggling `isDark` in `ThemeContext`.

For packaging, testing, and release mechanics, continue with the distribution checklist.
