from __future__ import annotations


from .health import get_or_refresh_summary_sync

from .models import HealthStatus


_STATUS_LABELS = {
    HealthStatus.HEALTHY: "Healthy",
    HealthStatus.DEGRADED: "Degraded",
    HealthStatus.DOWN: "Down",
    HealthStatus.UNKNOWN: "Unknown",
}


def _format_component_metric(component) -> dict:
    label = component.component.title()
    status_label = _STATUS_LABELS.get(component.status, component.status.value.title())
    latency = component.latency_ms
    description = component.message
    if latency is not None:
        description = f"{description} (latency {latency:.0f} ms)"
    return {
        "label": f"{label} service",
        "value": status_label,
        "description": description,
    }


def build_context() -> dict:

    summary = get_or_refresh_summary_sync()

    metrics = [
        {
            "label": "Overall health",
            "value": _STATUS_LABELS.get(summary.overall_status, summary.overall_status.value.title()),
            "description": summary.notes,
        }
    ]
    metrics.extend(_format_component_metric(component) for component in summary.components)
    return {"metrics": metrics}

