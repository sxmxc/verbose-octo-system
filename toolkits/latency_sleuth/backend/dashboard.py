from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from .models import ProbeHistoryEntry, utcnow
from .storage import list_history, list_templates


def _count_breaches(entry: ProbeHistoryEntry) -> int:
    return sum(1 for sample in entry.summary.samples if sample.breach)


def build_context() -> dict:
    templates = list_templates()
    now = utcnow()
    window_start = now - timedelta(hours=24)
    upcoming_threshold = now + timedelta(minutes=15)

    runs_last_day = 0
    breaches_last_day = 0
    for template in templates:
        history: Iterable[ProbeHistoryEntry] = list_history(template.id, limit=96)
        for entry in history:
            if entry.recorded_at < window_start:
                continue
            runs_last_day += 1
            breaches_last_day += _count_breaches(entry)

    upcoming_runs = sum(
        1
        for template in templates
        if template.next_run_at is not None and template.next_run_at <= upcoming_threshold
    )

    templates_description = (
        "Author probe templates to start scheduled latency checks."
        if not templates
        else "Templates actively scheduling synthetic probes."
    )

    return {
        "metrics": [
            {
                "label": "Templates",
                "value": len(templates),
                "description": templates_description,
            },
            {
                "label": "24h runs",
                "value": runs_last_day,
                "description": (
                    f"{breaches_last_day} breach(es) in the last 24 hours. "
                    f"Upcoming runs (15m): {upcoming_runs}."
                ),
            },
        ]
    }


__all__ = ["build_context"]
