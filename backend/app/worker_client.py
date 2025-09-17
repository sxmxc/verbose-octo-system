import os, uuid, json
from redis import Redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
r = Redis.from_url(REDIS_URL, decode_responses=True)

JOBS_KEY = "zbxadmin:jobs"

def enqueue_job(job_type: str, payload: dict) -> str:
    job_id = str(uuid.uuid4())
    job = {"id": job_id, "type": job_type, "payload": payload, "status": "queued", "progress": 0}
    r.hset(JOBS_KEY, job_id, json.dumps(job))
    # Push to Celery via a queue key for the worker to pick up
    from celery import Celery
    celery_app = Celery("zbx_admin", broker=REDIS_URL, backend=REDIS_URL)
    celery_app.send_task("worker.tasks.run_job", args=[job_id])
    return job_id

def get_job_status(job_id: str) -> dict:
    data = r.hget(JOBS_KEY, job_id)
    if not data:
        return {"id": job_id, "status": "not_found"}
    return json.loads(data)
