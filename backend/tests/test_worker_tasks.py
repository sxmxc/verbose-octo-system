import unittest
from unittest.mock import patch

from worker import tasks


class FakeJobStore:
    TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}

    def __init__(self, job):
        self.job = job
        self.saved = []
        self.logs = []

    def get_job(self, job_id):
        return self.job

    def save_job(self, job, update_timestamp=True):
        self.saved.append(job.copy())
        self.job = job

    def append_log(self, job, message):
        self.logs.append(message)
        job.setdefault("logs", []).append({"message": message})
        return job

    def mark_cancelled(self, job, message=None):
        job["status"] = "cancelled"
        if message:
            return self.append_log(job, message)
        return job

    def mark_cancelling(self, job, message=None):
        job["status"] = "cancelling"
        if message:
            return self.append_log(job, message)
        return job


class WorkerTaskTests(unittest.TestCase):
    def tearDown(self):
        tasks.unregister_handler("demo.run")

    def _run_with_job(self, job, handler):
        fake_store = FakeJobStore(job)
        with patch.object(tasks, "job_store", fake_store):
            tasks.register_handler("demo.run", handler)
            result = tasks.run_job(job["id"])
        return result, fake_store

    def test_run_job_defaults_to_success_status(self):
        job = {
            "id": "job-1",
            "type": "demo.run",
            "status": "queued",
            "progress": 0,
            "logs": [],
        }
        handler = lambda payload: payload  # Handler omits status/progress updates
        result, store = self._run_with_job(job, handler)

        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(result["progress"], 100)
        self.assertIn("Job execution started", store.logs[0])

    def test_run_job_handles_handler_failure(self):
        job = {
            "id": "job-2",
            "type": "demo.run",
            "status": "queued",
            "progress": 0,
            "logs": [],
        }

        def handler(payload):
            raise RuntimeError("boom")

        result, store = self._run_with_job(job, handler)
        self.assertEqual(result["status"], "failed")
        self.assertIn("Error: boom", store.logs[-1])

    def test_run_job_respects_cancellation(self):
        job = {
            "id": "job-3",
            "type": "demo.run",
            "status": "cancelling",
            "progress": 0,
            "logs": [],
        }

        def handler(payload):
            payload["status"] = "succeeded"
            return payload

        fake_store = FakeJobStore(job)
        with patch.object(tasks, "job_store", fake_store):
            tasks.register_handler("demo.run", handler)
            tasks.run_job(job["id"])

        self.assertEqual(fake_store.job["status"], "cancelled")
        self.assertTrue(any("Cancellation" in message for message in fake_store.logs))
