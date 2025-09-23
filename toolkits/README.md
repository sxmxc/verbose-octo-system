# Toolkit Development Helpers

This directory contains bundled toolkits and utility scripts for packaging your own.

## Packaging a toolkit

The repository's **Release** workflow packages toolkits automatically on every push to `main`:

1. Build any frontend bundles so files such as `frontend/dist/index.js` exist.
2. Commit the assets, open a pull request, and merge into `main`.
3. Download the `toolkit-<slug>` artifact produced by the Release workflow (either from the run summary or via `gh run download`).

The workflow runs `toolkits/scripts/package_all_toolkits.py` internally, enforcing manifest validation, slug allowlists, and filesystem safety rules. The standalone helper remains available for local smoke tests, but day-to-day releases should rely on CI.

## Bundled examples

- `toolkits/bundled/regex`
- `toolkits/bundled/toolbox_health`
- `toolkits/bundled/zabbix`

Each bundled toolkit includes a `BUILDING.md` file with notes on how we assemble its distribution bundle.
