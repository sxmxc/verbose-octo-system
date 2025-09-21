from __future__ import annotations

from toolkits.latency_sleuth.backend.dashboard import build_context
from toolkits.latency_sleuth.backend.models import ProbeTemplateCreate
from toolkits.latency_sleuth.backend.probes import execute_probe
from toolkits.latency_sleuth.backend.storage import create_template, record_probe_result


def test_dashboard_metrics(fake_redis) -> None:
    template = create_template(
        ProbeTemplateCreate(
            name="Checkout",
            url="https://example.com/checkout",
            sla_ms=200,
            interval_seconds=120,
            notification_rules=[],
            tags=[],
        )
    )

    summary = execute_probe(template, sample_size=2, overrides=[150, 350])
    record_probe_result(summary)

    context = build_context()
    metrics = {metric["label"]: metric for metric in context["metrics"]}

    assert metrics["Templates"]["value"] == 1
    assert metrics["Upcoming runs (15m)"]["value"] >= 1
    assert metrics["Runs (24h)"]["value"] == 1
    assert metrics["Breaches (24h)"]["value"] == 1
