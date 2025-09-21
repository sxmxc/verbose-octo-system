from __future__ import annotations

from typing import Iterable, List
from unittest.mock import patch

from app.services import jobs as job_service


class FakeRedis:
    def __init__(self, jobs: Iterable[dict]):
        self._values = [job_service._dump(job) for job in jobs]

    def hvals(self, key: str) -> List[str]:  # pragma: no cover - exercised via tests
        return list(self._values)


def _job(
    *,
    job_id: str,
    toolkit: str,
    module: str,
    created_at: str,
) -> dict:
    return {
        "id": job_id,
        "toolkit": toolkit,
        "module": module,
        "operation": "test.run",
        "type": f"{toolkit}.test.run",
        "status": "queued",
        "progress": 0,
        "logs": [],
        "created_at": created_at,
        "updated_at": created_at,
    }


def test_list_jobs_filters_by_module_only():
    jobs = [
        _job(
            job_id="job-alpha",
            toolkit="alpha",
            module="alpha.core",
            created_at="2024-01-01T00:00:00+00:00",
        ),
        _job(
            job_id="job-beta-utils",
            toolkit="beta",
            module="beta.utils",
            created_at="2024-01-02T00:00:00+00:00",
        ),
        _job(
            job_id="job-beta-gamma",
            toolkit="beta",
            module="gamma.special",
            created_at="2024-01-03T00:00:00+00:00",
        ),
    ]

    fake_redis = FakeRedis(jobs)
    with patch("app.services.jobs.get_redis", return_value=fake_redis):
        results, total = job_service.list_jobs(modules=["gamma.special"])

    assert total == 1
    assert [job["id"] for job in results] == ["job-beta-gamma"]


def test_list_jobs_applies_toolkit_and_module_filters_independently():
    jobs = [
        _job(
            job_id="job-alpha",
            toolkit="alpha",
            module="alpha.core",
            created_at="2024-01-01T00:00:00+00:00",
        ),
        _job(
            job_id="job-beta-utils",
            toolkit="beta",
            module="beta.utils",
            created_at="2024-01-02T00:00:00+00:00",
        ),
        _job(
            job_id="job-beta-gamma",
            toolkit="beta",
            module="gamma.special",
            created_at="2024-01-03T00:00:00+00:00",
        ),
    ]

    fake_redis = FakeRedis(jobs)
    with patch("app.services.jobs.get_redis", return_value=fake_redis):
        results, total = job_service.list_jobs(toolkits=["beta"], modules=["beta.utils"])

    assert total == 1
    assert [job["id"] for job in results] == ["job-beta-utils"]


def test_list_jobs_filters_by_status():
    jobs = [
        {**_job(job_id="job-queued", toolkit="alpha", module="alpha.core", created_at="2024-01-01T00:00:00+00:00"), "status": "queued"},
        {**_job(job_id="job-success", toolkit="alpha", module="alpha.core", created_at="2024-01-02T00:00:00+00:00"), "status": "succeeded"},
        {**_job(job_id="job-failed", toolkit="alpha", module="alpha.core", created_at="2024-01-03T00:00:00+00:00"), "status": "failed"},
    ]

    fake_redis = FakeRedis(jobs)
    with patch("app.services.jobs.get_redis", return_value=fake_redis):
        results, total = job_service.list_jobs(statuses=["succeeded", "failed"])

    assert total == 2
    assert [job["id"] for job in results] == ["job-failed", "job-success"]


def test_list_jobs_supports_offset_and_limit():
    jobs = [
        _job(job_id=f"job-{idx}", toolkit="alpha", module="alpha.core", created_at=f"2024-01-{idx:02d}T00:00:00+00:00")
        for idx in range(1, 6)
    ]

    fake_redis = FakeRedis(jobs)
    with patch("app.services.jobs.get_redis", return_value=fake_redis):
        results, total = job_service.list_jobs(limit=2, offset=1)

    assert total == 5
    assert [job["id"] for job in results] == ["job-4", "job-3"]
