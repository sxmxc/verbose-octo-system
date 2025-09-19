from __future__ import annotations

from .storage import list_targets


def build_context() -> dict:
    targets = list_targets()
    total_endpoints = sum(len(target.endpoints) for target in targets)
    description = (
        "Define probe groups to begin running connectivity checks."
        if not targets
        else "Ready to launch bulk reachability checks across defined endpoints."
    )
    return {
        "metrics": [
            {
                "label": "Probe groups",
                "value": len(targets),
                "description": description,
            },
            {
                "label": "Endpoints",
                "value": total_endpoints,
                "description": "Total hosts configured across all probe groups.",
            },
        ]
    }
