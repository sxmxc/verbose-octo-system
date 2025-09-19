# Toolkit UI Guide

Toolkit UIs render inside the SRE Toolbox shell alongside core Toolbox pages. Use these guidelines to design consistent, maintainable operator experiences that feel native in both light and dark themes.

## Toolkit Entry Points

- `frontend/index.tsx`: registers routes beneath `/toolkits/<slug>`.
- `frontend/runtime.ts`: bridges the host shell runtime helpers (`React`, `react-router-dom`, `apiFetch`).
- `toolkit.json`: set `frontend_entry` or `frontend_source_entry` so the shell knows where to load your UI.

## Layout & Navigation

- Use React Router to structure nested routes and keep URLs predictable.
- Mirror the shell’s spacing scale (`0.25rem`, `0.5rem`, `0.75rem`, `1rem`) and card styling.
- Pull icons from the Material Symbols set for a unified look.
- Surface primary actions on the left within each section; secondary actions can sit to the right.
- Respect the active theme—reference CSS variables (see [Toolkit Overview](toolkit)) instead of hard-coded colors.

## Data Fetching

- Use `apiFetch` to call toolkit endpoints; it automatically scopes requests to the runtime base URL and handles JSON.
- Display loading states and error banners; lean on the shared token + runtime error conventions for consistency.

## Shared Toolkit Primitives

- The shell injects `toolkitPrimitives.css`, a tiny baseline for cards, form fields, and buttons.
- Apply the `tk-` prefixed helpers (`tk-card`, `tk-button`, `tk-button--primary`, `tk-input`, `tk-fieldset`, `tk-legend`, `tk-label`, `tk-tag`) to inherit host styling immediately.
- Primitives respect the theme variables exposed by `ThemeContext`, so custom toolkits stay in sync across light/dark modes.
- Extend or override the classes inside your toolkit as needed—they exist for convenience, not as a full design system.

## Composing with Workers

- Link UI actions to the job system via the toolkit [Toolkit Worker Guide](toolkit-worker) endpoints.
- Show job progress inline, or deep-link to `/jobs` filtered by toolkit slug.

## Local Development

- During `npm run dev`, point `frontend_source_entry` to the TypeScript entry so Vite loads your code with hot reload.
- Keep styles encapsulated—prefer component-level style objects or CSS Modules to avoid clashing with the host shell.
- Use [`ThemeContext`](../src/ThemeContext.tsx) helpers or CSS variables to test light and dark palettes locally.

For end-to-end integration steps, revisit the [Toolkit Overview](toolkit) and the walkthroughs in the [Examples](examples-basic-toolkit) section.
