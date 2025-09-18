from app.toolkit_loader import load_toolkit_workers, register_celery
from app.toolkits.seeder import ensure_bundled_toolkits_installed
from .celery_app import celery_app


register_celery(celery_app)
ensure_bundled_toolkits_installed()

load_toolkit_workers(celery_app)

__all__ = ["celery_app"]
