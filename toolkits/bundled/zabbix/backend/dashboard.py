from __future__ import annotations

from .storage import list_instances


def build_context() -> dict:
    instances = list_instances()
    count = len(instances)
    description = (
        "Set up a Zabbix endpoint to unlock automation workflows."
        if count == 0
        else "Endpoints ready for bulk host imports and scheduled automation."
    )

    return {
        "metrics": [
            {
                "label": "Configured instances",
                "value": count,
                "description": description,
            }
        ]
    }
