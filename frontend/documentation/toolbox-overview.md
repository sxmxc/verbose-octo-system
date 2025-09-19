# Toolbox Overview

Welcome to the SRE Toolbox documentation hub. These guides explain how the Toolbox framework boots, how administrators operate built-in features, and how toolkit authors can extend the platform.

## What To Read First

- [Toolbox Administration](toolbox-administration): enable, disable, and manage toolkit lifecycles from the host shell.
- [Toolbox Job Monitoring](toolbox-job-monitoring): understand how background work flows through the shared queue and dashboards.
- [Toolkit Overview](toolkit): build distributable bundles that stitch together backend routes, workers, and UI experiences.
- [Toolkit Build Workflow](toolkit-build): package toolkits consistently for distribution.

## How Documentation Is Organized

- **Toolbox** articles cover host capabilities such as toolkit management, job orchestration, storage, and environment configuration.
- **Toolkit** articles focus on authoring experiences—backend, worker, and UI facets that ship inside a toolkit bundle.
- **Examples** showcase end-to-end samples you can adapt for your own automation projects.

Add more markdown files under `frontend/documentation` to expand the knowledge base. Every file automatically appears in this navigation and can deep-link to the others.

## Contributing

- Keep each document focused and concise.
- Prefer Markdown for readability and version control friendliness.
- Cross-link related docs so operators can follow a narrative from concept to execution.

Happy building!
