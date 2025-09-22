# Latency Sleuth Overview

## Purpose
Latency Sleuth helps SREs model end-to-end web latency with synthetic probes so they can validate SLAs, surface performance drift, and rehearse incident response before changes reach production.

## Primary Workflows
1. **Author probe templates.** Define the target URL, method, cadence, SLA thresholds, and notification rules for each synthetic check. Tag templates with service identifiers so dashboards roll up coverage correctly.
2. **Preview and tune thresholds.** Use the built-in heatmaps and scheduling panels to watch how probes behave over time, adjusting alert windows until they reflect real user expectations.
3. **Monitor executions and alerts.** Follow live job logs for in-flight probes, review breach streaks, and confirm notifications reach Slack, PagerDuty, or webhook targets as configured.

## Operator References
- [Latency Sleuth Operator Guide](./OPERATOR.md)
