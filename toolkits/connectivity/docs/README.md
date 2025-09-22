# Bulk Connectivity Checker Overview

## Purpose
The Bulk Connectivity Checker orchestrates large batches of reachability probes so operators can validate port access, spot regional failures, and launch remediation workflows across entire host fleets.

## Primary Workflows
1. **Curate connectivity targets.** Group hosts and ports into reusable target definitions that document probe intent and act as the source of truth for recurring checks.
2. **Preview probe runs.** Dry-run a target to estimate expected failures and latency before scheduling a job, helping tune repetition counts and confirming the catalog is accurate.
3. **Execute and monitor jobs.** Dispatch bulk probe operations to the worker queue, then watch job logs for per-endpoint success, failure details, and cancellation status.
4. **Run ad-hoc spot checks.** Trigger one-off connectivity tests against custom endpoint lists when investigating incidents or validating remediation.

## Operator References
- [Bulk Connectivity Checker Operator Guide](./OPERATOR.md)
