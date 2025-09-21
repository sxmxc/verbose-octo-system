# Latency Sleuth Operator Guide

Latency Sleuth provisions repeatable HTTP probes so SREs can tune alert windows before shipping changes to production. Use this
reference when onboarding a new service or adjusting SLAs after an incident.

## Designing a Probe Template
1. Open **Toolkits → Synthetic Probes**.
2. Use the **Probe Designer** to define:
   - **Target URL** – the endpoint you expect to respond quickly.
   - **HTTP Method** – `GET`, `HEAD`, or `POST` depending on the cheapest call that exercises the dependency chain.
   - **Latency SLA (ms)** – breach threshold for a single attempt.
   - **Interval (seconds)** – cadence for scheduled runs. Keep values above 30 seconds to avoid overwhelming fragile hosts.
     The worker automatically queues probes on this rhythm; the catalog lists the next dispatch time so you can confirm coverage.
   - **Notification Rules** – choose Slack, email, PagerDuty, or webhook targets. Rules fire on breaches by default; set the
     threshold to `always` to receive every sample or `recovery` to confirm when latency stabilises.
3. Tag templates with service identifiers so heatmaps group logically in the overview.
4. Save the template. The catalog lists creation/update times and serves as the source of truth for change reviews.

The scheduler runs inside the worker process; templates begin dispatching immediately and continue at the chosen cadence even
after restarts. Monitor upcoming executions in the **Scheduling** panel within the Job Logs tab.

## Tuning SLAs
- Start with the 95th percentile of production latency plus a 10% buffer.
- After a week of historical data, review the **Latency Heatmap** for streaks of breaches.
- Adjust the SLA upward when synthetic probes regularly breach but user experience remains healthy.
- Lower the SLA cautiously to detect regressions earlier, validating that your on-call rotation can absorb the alert volume.

## Alert Wiring
- Slack targets work best for daytime signal; use dedicated channels per service to preserve history.
- PagerDuty alerts should reference runbook URLs in the webhook payload so responders can escalate quickly.
- When chaining to a webhook, expect a JSON body shaped like:
  ```json
  {
    "template_id": "uuid",
    "template_name": "Checkout API",
    "breach_count": 2,
    "average_latency_ms": 640.5,
    "samples": [
      { "attempt": 1, "latency_ms": 602.1, "breach": true },
      { "attempt": 2, "latency_ms": 678.9, "breach": true }
    ]
  }
  ```
- Use the **Job Log Viewer** to verify notifications after editing rules. The viewer now lists recent scheduled and manual runs;
  pick any entry to stream logs or jump into a live execution.

## Release Process
1. Run the toolkit unit tests:
   ```bash
   pytest toolkits/latency_sleuth/tests
   npm --prefix frontend test -- --run toolkits/latency_sleuth/frontend
   ```
2. Package the bundle using `toolkits/scripts/package_toolkit.py`.
3. Attach `latency-sleuth_toolkit.zip` and updated release notes to your distribution channel.
4. After installation, confirm the dashboard card links to `/toolkits/latency-sleuth`.

For troubleshooting, inspect Celery worker logs for `latency-sleuth.run_probe` entries and check Redis keys prefixed with
`toolkits:latency_sleuth` to ensure telemetry is flowing.
