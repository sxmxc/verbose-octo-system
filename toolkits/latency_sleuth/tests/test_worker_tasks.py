from __future__ import annotations

from app.services import jobs as job_store

from toolkits.latency_sleuth.backend.models import ProbeTemplateCreate
from toolkits.latency_sleuth.backend.storage import (
    create_template,
    get_template,
    list_history,
)
from datetime import timedelta

from toolkits.latency_sleuth.backend.models import utcnow
from toolkits.latency_sleuth.worker import tasks


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

    result = tasks._handle_run_probe(job)

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

    result = tasks._handle_run_probe(job)

    assert result["status"] == "cancelled"

    history = list_history(template_id)
    assert history == []


class _DummyAsyncResult:
    def __init__(self, task_id: str) -> None:
        self.id = task_id


class _DummyCelery:
    def __init__(self) -> None:
        self.sent = []
        self._counter = 0
        self.tasks = {}

    def send_task(self, name: str, args=None, kwargs=None, **options):
        self._counter += 1
        task_id = f"task-{self._counter}"
        self.sent.append((name, args, kwargs))
        return _DummyAsyncResult(task_id)


class _DummyApplyTask:
    def __init__(self, celery: _DummyCelery) -> None:
        self._celery = celery

    def apply_async(self, args=None, kwargs=None, **options):
        self._celery._counter += 1
        task_id = f"task-{self._celery._counter}"
        self._celery.sent.append(("apply_async", args, kwargs))
        return _DummyAsyncResult(task_id)


def test_scheduler_dispatches_due_template(fake_redis) -> None:
    template_id = _make_template()
    celery = _DummyCelery()

    tasks._dispatch_due_probes(celery)

    assert len(celery.sent) == 1
    name, args, _ = celery.sent[0]
    assert name == "worker.tasks.run_job"

    jobs, total = job_store.list_jobs()
    assert total == 1
    assert args == [jobs[0]["id"]]

    template = get_template(template_id)
    assert template is not None
    assert template.next_run_at is not None
    assert template.next_run_at > template.created_at

    tasks._dispatch_due_probes(celery)
    assert len(celery.sent) == 1


def test_scheduler_skips_when_job_active(fake_redis) -> None:
    template_id = _make_template()
    celery = _DummyCelery()

    active_job = job_store.create_job(
        "latency-sleuth",
        "run_probe",
        {"template_id": template_id},
    )
    active_job["status"] = "running"
    job_store.save_job(active_job)

    before = get_template(template_id)
    assert before is not None
    prior_next_run = before.next_run_at

    tasks._dispatch_due_probes(celery)

    assert celery.sent == []

    after = get_template(template_id)
    assert after is not None
    assert after.next_run_at == prior_next_run


def test_scheduler_resubmits_stale_job(fake_redis) -> None:
    template_id = _make_template()
    job = job_store.create_job(
        "latency-sleuth",
        "run_probe",
        {"template_id": template_id},
    )
    job["status"] = "queued"
    job["updated_at"] = (utcnow() - timedelta(minutes=5)).isoformat()
    job_store.save_job(job, update_timestamp=False)

    celery = _DummyCelery()
    celery.tasks["worker.tasks.run_job"] = _DummyApplyTask(celery)

    tasks._resubmit_stale_jobs(celery, now=utcnow())

    reloaded = job_store.get_job(job["id"])
    assert reloaded is not None
    assert reloaded.get("celery_task_id") == "task-1"
    assert any("Resubmitted" in entry["message"] for entry in reloaded.get("logs", []))
