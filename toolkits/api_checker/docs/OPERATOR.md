# API Checker Operator Guide

Use this runbook to exercise HTTP requests against internal or third-party services when verifying incidents, regression fixes, or SLA compliance.

## Build a Request
1. Open **Toolkits → API Checker**.
2. Select the HTTP method and provide the full URL, including query string if required.
3. Configure optional inputs:
   - Add query parameters and headers. Toggle entries off to keep them for later without sending them.
   - Set a timeout (1–120 seconds) and decide whether redirects should be followed.
   - Choose a request body mode:
     - **None** – send no payload.
     - **Raw** – paste any text payload. Optionally override the `Content-Type` header.
     - **JSON** – paste JSON content; the toolkit validates syntax before sending.
   - Pick an authentication mode:
     - **Basic** – provide username and password.
     - **Bearer** – supply an access token; the header is added automatically.
     - **API Key** – define a custom header name/value pair.

## Execute and Review
1. Click **Send Request**. The request is issued via the toolkit backend using your configuration.
2. On success, review:
   - Status line and HTTP version.
   - Total duration, payload size, and detected content type.
   - Response body preview (with truncation notice when over 64 KB) and JSON formatting when available.
   - Response and request headers side by side for auditing.
3. On failure, read the surfaced error banner. Timeout and validation errors include actionable guidance (e.g., malformed JSON).

## Manage History
- Every request is saved automatically with timestamp, configuration, and response outcome.
- Use the **History** panel to replay an entry; selecting one repopulates the form for iterative testing.
- Clear history when you need to scrub sensitive headers. Up to 25 entries are retained to avoid stale clutter.

## Operational Tips
- Duplicate an entry and disable headers to simulate degraded clients without losing the full configuration.
- Combine API Checker results with latency dashboards to confirm whether regressions are client-side or server-side.
- Export response payloads or headers when filing incident reports or regression tickets.
