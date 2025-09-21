from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services import jobs as job_store

from toolkits.latency_sleuth.backend.app import router
from toolkits.latency_sleuth.backend.models import ProbeTemplate
from toolkits.latency_sleuth.backend.probes import execute_probe
from toolkits.latency_sleuth.backend.storage import record_probe_result


def create_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="")
    return TestClient(app)


def _create_template(client: TestClient) -> dict:
    response = client.post(
        "/probe-templates",
        json={
            "name": "Checkout",
            "url": "https://example.com/checkout",
            "sla_ms": 450,
            "method": "GET",
            "interval_seconds": 120,
            "notification_rules": [
                {"channel": "slack", "target": "#alerts", "threshold": "breach"},
            ],
            "tags": ["service:checkout"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_and_list_templates(fake_redis) -> None:
    client = create_client()

    created = _create_template(client)
    assert created["name"] == "Checkout"
    assert created["sla_ms"] == 450
    assert created["notification_rules"][0]["channel"] == "slack"
    assert created["next_run_at"] is not None

    listing = client.get("/probe-templates")
    assert listing.status_code == 200
    payload = listing.json()
    assert len(payload) == 1
    assert payload[0]["id"] == created["id"]
    assert payload[0]["next_run_at"] is not None


def test_preview_endpoint_returns_summary(fake_redis) -> None:
    client = create_client()
    template = _create_template(client)

    preview = client.post(
        f"/probe-templates/{template['id']}/actions/preview",
        json={"sample_size": 2, "latency_overrides": [480, 80]},
    )
    assert preview.status_code == 200
    data = preview.json()
    assert data["template_id"] == template["id"]
    assert len(data["samples"]) == 2
    assert data["breach_count"] == 1


def test_run_endpoint_enqueues_job(monkeypatch, fake_redis) -> None:
    client = create_client()
    template = _create_template(client)

    captured = {}

    def fake_enqueue(toolkit: str, operation: str, payload: dict) -> dict:
        captured["args"] = (toolkit, operation, payload)
        return {"id": "job-123", "status": "queued", "logs": []}

    monkeypatch.setattr("toolkits.latency_sleuth.backend.app.enqueue_job", fake_enqueue)

    response = client.post(
        f"/probe-templates/{template['id']}/actions/run",
        json={"sample_size": 4},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["job"]["id"] == "job-123"
    assert captured["args"][0] == "latency-sleuth"
    assert captured["args"][1] == "run_probe"
    assert captured["args"][2]["sample_size"] == 4


def test_heatmap_endpoint_returns_cells(fake_redis) -> None:
    client = create_client()
    template = _create_template(client)

    template_model = ProbeTemplate.model_validate(template)
    summary = execute_probe(template_model, sample_size=3, overrides=[100, 120, 90])
    record_probe_result(summary)

    response = client.get(f"/probe-templates/{template['id']}/heatmap")
    assert response.status_code == 200
    data = response.json()
    assert data["template_id"] == template["id"]
    assert len(data["rows"]) >= 1


def test_job_endpoints(fake_redis) -> None:
    client = create_client()
    template = _create_template(client)

    job = job_store.create_job("latency-sleuth", "run_probe", {"template_id": template["id"]})

    listing = client.get("/jobs")
    assert listing.status_code == 200
    jobs = listing.json()
    assert any(item["id"] == job["id"] for item in jobs)

    detail = client.get(f"/jobs/{job['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == job["id"]


def test_interval_update_resets_next_run(fake_redis) -> None:
    client = create_client()
    template = _create_template(client)

    original_next = datetime.fromisoformat(template["next_run_at"])

    response = client.put(
        f"/probe-templates/{template['id']}",
        json={"interval_seconds": template["interval_seconds"] // 2},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["next_run_at"] is not None
    refreshed_next = datetime.fromisoformat(updated["next_run_at"])
    assert refreshed_next >= original_next
