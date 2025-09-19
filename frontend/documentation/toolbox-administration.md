# Toolbox Administration

Administrators manage toolkit lifecycles directly from the SRE Toolbox shell. This guide covers the high-level workflow and common tasks you can automate.

## Enabling and Disabling Toolkits

1. Navigate to **Administration → Toolkits**.
2. Flip the toggle beside a toolkit to enable or disable it.
3. The change is immediate—enabled toolkits register routes, workers, and UI panels without restarting the Toolbox runtime.
4. Use the status indicator in the Toolkit card to confirm deployment.

## Uploading a New Toolkit Bundle

1. Build a `.zip` bundle that contains `toolkit.json`, `backend/`, `worker/`, and (optionally) `frontend/`.
2. In **Administration → Toolkits**, scroll to **Install toolkit bundle (.zip)**.
3. Provide an optional slug override or allow the bundle metadata to define it.
4. Submit the form—uploads are asynchronously extracted and registered.
5. Enable the toolkit once validation passes.

The REST API mirrors the UI form so you can script installations:

```bash
curl -X POST \
  -F slug=my-toolkit \
  -F file=@toolkit.zip \
  http://localhost:8000/toolkits/install
```

## Updating an Existing Toolkit

- Upload a new bundle with the same slug. The Toolbox runtime swaps assets atomically and bumps the version timestamp.
- Use `toolkit.json`’s `frontend_entry` or `frontend_source_entry` to point to fresh UI builds.
- The runtime invalidates cached toolkit modules when metadata timestamps change.

## Removing a Toolkit

1. Disable the toolkit to ensure no new jobs are scheduled.
2. Click **Uninstall** on the toolkit card. Only uploaded (non-built-in) toolkits expose this action.
3. The API and UI both delete the bundle payload and registry entry.

```bash
curl -X DELETE http://localhost:8000/toolkits/my-toolkit
```

## Automating Administration

- Use the `/toolkits` REST endpoints to integrate with CI/CD pipelines.
- Schedule periodic audits with the [Toolbox Job Monitoring](toolbox-job-monitoring) guidance to ensure idle toolkits can be toggled off.
- Keep documentation in sync by linking to the relevant toolkit entry under [Toolkit Overview](toolkit).

Continue with [Toolbox Job Monitoring](toolbox-job-monitoring) to understand how worker activity is surfaced to operators.
