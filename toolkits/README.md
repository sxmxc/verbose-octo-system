# Toolkit Development Helpers

This directory contains bundled toolkits and utility scripts for packaging your own.

## Packaging a toolkit

Use the helper script to validate a toolkit directory and generate a distributable `.zip`:

```bash
python toolkits/scripts/package_toolkit.py toolkits/bundled/zabbix
```

The script checks that:

- `toolkit.json` exists and declares a slug.
- The slug only contains lowercase letters, numbers, hyphen (`-`), or underscore (`_`).
- Files referenced by `frontend.entry` / `frontend.source_entry` are present.
- Default `frontend/dist/index.js` is included when no entry is specified.

By default the archive is written next to the toolkit as `<slug>_toolkit.zip`. Supply `--output` to place it elsewhere and `--force` to overwrite existing files.

## Bundled examples

- `toolkits/bundled/regex`
- `toolkits/bundled/zabbix`

Each bundled toolkit includes a `BUILDING.md` file with notes on how we assemble its distribution bundle.
