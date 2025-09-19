from fastapi import APIRouter, Depends

from ..config import settings
from ..security.dependencies import require_roles
from ..security.roles import ROLE_TOOLKIT_USER

router = APIRouter()


@router.get(
    "/getting-started",
    summary="Toolkit packaging guide",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkit_getting_started():
    """Provide inline documentation for toolkit developers."""

    return {
        "overview": "Toolkits are self-contained integrations that expose API routes under /toolkits/<slug> and optionally contribute frontend assets.",
        "bundle_format": {
            "type": "zip",
            "contents": [
                "backend/ - FastAPI routers, dependencies, Pydantic models",
                "worker/ - Celery tasks packaged as importable modules",
                "frontend/ - Optional React components (Vite compatible)",
                "toolkit.json - metadata (slug, name, backend/worker entrypoints, dashboard cards)",
            ],
        },
        "upload": {
            "endpoint": "POST /toolkits/install",
            "form_fields": {
                "slug": "Optional override for toolkit slug (letters, numbers, hyphen, underscore)",
                "file": "Zip bundle (max size defined by deployment)"
            },
            "post_install": "Toolkit is staged disabled; once enabled the runtime imports backend routes, registers Celery tasks, and surfaces dashboard cards automatically.",
        },
        "job_queue": {
            "enqueue": "POST /toolkits/{slug}/jobs with form data 'operation' and optional JSON 'payload'",
            "tracking": "Use /jobs and /jobs/{id} to monitor progress and cancellation",
            "handlers": "Expose a callable (default 'register') in your worker module so SRE Toolbox can register `<slug>.<operation>` tasks with Celery automatically.",
        },
        "storage": {
            "bundle_dir": str(settings.toolkit_storage_dir),
            "registry": "Stored in Redis under key sretoolbox:toolkits:registry",
        },
        "dashboard": "Advertise quick links by supplying dashboard_cards in toolkit.json; optionally include a dashboard.module + callable to surface metrics inside the global dashboard card once the toolkit is enabled.",
    }
