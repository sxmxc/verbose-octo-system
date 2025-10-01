# Toolkit Versioning Guide

Consistent version numbers help curators decide when to upgrade bundles and allow the Toolbox UI to surface accurate badges. Toolkits MUST follow semantic versioning (`MAJOR.MINOR.PATCH`) in their `toolkit.json` manifest and any release notes.

## Version components
- **MAJOR**: Increment when you introduce breaking changes that require operator action (database migrations that cannot be rolled back automatically, incompatible API responses, removed routes, renamed environment variables).
- **MINOR**: Increment when you add new, backward-compatible capability (new UI tabs, optional API endpoints, additional job handlers) without forcing configuration changes.
- **PATCH**: Increment for bug fixes, dependency upgrades that do not change behaviour, documentation-only corrections, or internal refactors that keep public contracts stable.

Pre-release identifiers (e.g. `1.2.0-beta.1`) and build metadata (`+build.5`) are optional but MUST follow [Semantic Versioning 2.0.0](https://semver.org/) formatting. Avoid reusing version numbers—once a version is published, it is immutable.

## When to bump versions
Use the following checklist when deciding which component to bump:
- Are operators required to run data migrations, rotate credentials, or change automation scripts? → **MAJOR**.
- Did you add new functionality while keeping existing APIs, events, and UI intact? → **MINOR**.
- Is the release fixing defects, polishing copy, or tightening observability without altering contracts? → **PATCH**.

Bundle packaging captures `toolkit.json` verbatim, so the manifest version must be updated before the release workflow runs. Update the version **before** you merge so CI artifacts (`toolkit-<slug>/<slug>_toolkit.zip`) match the published release notes.

## Changelog expectations
Every release SHOULD include a changelog entry describing:
- Summary of operator-facing changes.
- Required follow-up tasks (migrations, new environment variables, feature flags).
- Known compatibility or downgrade caveats.

Store the changelog alongside your toolkit source (for example, `docs/CHANGELOG.md`) so the community repository and catalog cards can reference it. Link the entry in your release notes or documentation PR.

## Release workflow integration
- The Admin → Toolkits UI and API surfaces the manifest version. Ensure `toolkit.updated_at` is bumped when you release so the UI invalidates cached bundles.
- Keep previous bundle artifacts accessible; they are required for rollbacks when a major release introduces regressions.
- Coordinate version bumps with the [Testing & Release Checklist](./testing-and-release.md) to confirm automated tests, manual verification, and packaging complete successfully.

Following these rules keeps operators aligned on what changed, when to upgrade, and how to recover if a release regresses critical workflows.
