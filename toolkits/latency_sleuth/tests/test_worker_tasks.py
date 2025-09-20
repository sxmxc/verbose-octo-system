from __future__ import annotations

from app.services import jobs as job_store

from toolkits.latency_sleuth.backend.models import ProbeTemplateCreate
from toolkits.latency_sleuth.backend.storage import create_template, list_history
from toolkits.latency_sleuth.worker.tasks import _handle_run_probe


def _make_template() -> str:
    template = create_template(
        ProbeTemplateCreate(
            name="API",
            url="https://example.com/api",
            sla_ms=200,
            interval_seconds=120,
            notification_rules=[{"channel": "email", "target": "ops@example.com", "threshold": "breach"}],
            tags=["service:api"],
        )
    )
    return template.id


def test_handle_run_probe_success(fake_redis) -> None:
    template_id = _make_template()
    job = job_store.create_job(
        "latency-sleuth",
        "run_probe",
        {"template_id": template_id, "sample_size": 2, "latency_overrides": [50, 220]},
    )

    result = _handle_run_probe(job)

    assert result["status"] == "succeeded"
    assert result["progress"] == 100
    assert result["result"]["breach_count"] == 1

    history = list_history(template_id)
    assert len(history) == 1
    assert history[0].summary.template_id == template_id


def test_handle_run_probe_honours_cancellation(monkeypatch, fake_redis) -> None:
    template_id = _make_template()
    job = job_store.create_job(
        "latency-sleuth",
        "run_probe",
        {"template_id": template_id, "sample_size": 3, "latency_overrides": [210, 180, 150]},
    )

    original_get_job = job_store.get_job
    call_count = {"value": 0}

    def fake_get_job(job_id: str):
        record = original_get_job(job_id)
        call_count["value"] += 1
        if call_count["value"] == 2 and record:
            job_store.mark_cancelling(record, "Operator requested cancellation")
            record = original_get_job(job_id)
        return record

    monkeypatch.setattr(job_store, "get_job", fake_get_job)

    result = _handle_run_probe(job)

    assert result["status"] == "cancelled"

    history = list_history(template_id)
    assert history == []
