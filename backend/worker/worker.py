import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("zbx_admin", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.task_routes = {
    "worker.tasks.run_job": {"queue": "default"},
}
