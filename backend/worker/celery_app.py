from __future__ import annotations

from celery import Celery

from app.config import settings


celery_app = Celery("sre_toolbox", broker=settings.redis_url, backend=settings.redis_url)

# Configure default routing; additional routes can be added by workers as needed.
celery_app.conf.task_routes = {
    "worker.tasks.run_job": {"queue": "default"},
}
