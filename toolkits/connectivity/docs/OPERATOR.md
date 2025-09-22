# Bulk Connectivity Checker Operator Guide

Use this guide to manage connectivity catalogs, exercise probe workflows, and interpret job output during incidents.

## Maintain Target Catalogs
1. Navigate to **Toolkits → Connectivity Checks**.
2. Use **New Target** to define a fleet:
   - Give the group a descriptive name and context-rich description.
   - Add each host as a hostname or IP. Attach one or more ports per host and pick the protocol (`tcp` or `udp`).
   - Save changes. The catalog lists endpoint counts and last-updated timestamps so you can audit ownership.
3. Edit a target to add or remove hosts. Delete unused targets to keep the catalog current.

## Preview Probe Runs
- Open a target and choose **Preview Check** when you need a latency estimate before committing to a scheduled job.
- Set the repetition count to mirror your planned run. The preview returns reachability summaries immediately and does not create job records.
- Investigate failures directly from the preview panel: each result includes host, port, protocol, and failure message.

## Execute Bulk Jobs
1. From a target, choose **Run Connectivity Check**.
2. Specify the number of repetitions to increase confidence in the results. Each repetition performs a full sweep of all endpoints.
3. Submit the job. The worker queue records a log entry and begins processing; monitor progress from the job panel or the global **Jobs** page.
4. Job logs stream per-endpoint status with ✅/❌ markers. Cancel a job from the log viewer if the situation stabilises.
5. When complete, download the summary to share with incident channels or attach to remediation tickets.

## Ad-hoc Spot Checks
- Use **Ad-hoc Check** for one-off investigations that do not warrant catalog entries.
- Provide a temporary host/port list and optional repetitions. Results render inline for quick validation.

## Operational Tips
- Schedule follow-up jobs after remediation to confirm reachability is restored.
- For persistent failures, capture the latency and error message from the job logs to hand off to the owning team.
- Keep port lists lean; large TCP sweeps slow down worker throughput and inflate alert noise.
