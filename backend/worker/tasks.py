import os, json, time
from redis import Redis
from .worker import celery_app

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
r = Redis.from_url(REDIS_URL, decode_responses=True)
JOBS_KEY = "zbxadmin:jobs"

def _save(job):
    r.hset(JOBS_KEY, job["id"], json.dumps(job))

@celery_app.task(name="worker.tasks.run_job")
def run_job(job_id: str):
    data = r.hget(JOBS_KEY, job_id)
    if not data:
        return
    job = json.loads(data)
    job["status"] = "running"
    job["progress"] = 0
    _save(job)

    try:
        if job["type"] == "bulk_add_hosts":
            rows = job["payload"].get("rows", [])
            total = max(len(rows), 1)
            # Simulate work
            for i, _ in enumerate(rows, start=1):
                time.sleep(0.1)  # simulate API call
                job["progress"] = int(i / total * 100)
                _save(job)
            job["status"] = "succeeded"
            job["result"] = {"created": len(rows)}
        else:
            job["status"] = "failed"
            job["error"] = f"Unknown job type: {job['type']}"
    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
    finally:
        _save(job)
