import logging
from collections import Counter
from typing import Any, Dict

from fastapi import APIRouter, Depends

from ..services.jobs import list_jobs
from ..toolkit_loader import import_toolkit_module
from ..toolkits.registry import list_toolkits
from ..security.dependencies import require_roles
from ..security.roles import ROLE_TOOLKIT_USER


router = APIRouter()
logger = logging.getLogger(__name__)


ToolkitContext = Dict[str, Any]


@router.get(
    "/",
    summary="SRE Toolbox overview",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def dashboard_overview():
    recent_jobs, total_jobs = list_jobs(limit=50)
    status_counts = Counter(job.get("status", "unknown") for job in recent_jobs)
    toolkits = list_toolkits()
    cards = []
    toolkit_context_cache: Dict[str, ToolkitContext] = {}
    for toolkit in toolkits:
        if not toolkit.enabled:
            continue
        context: ToolkitContext = {}
        if toolkit.dashboard_context_module:
            try:
                module = import_toolkit_module(
                    toolkit.dashboard_context_module,
                    slug=toolkit.slug,
                    namespaces=("backend",),
                )
                attr_name = toolkit.dashboard_context_attr or "build_context"
                provider = getattr(module, attr_name, None)
                if callable(provider):
                    context = toolkit_context_cache.setdefault(toolkit.slug, provider())
            except Exception:  # pragma: no cover - defensive logging
                logger.exception(
                    "Failed to build dashboard context for toolkit %s", toolkit.slug,
                )
                context = {}
        if toolkit.dashboard_cards:
            for card in toolkit.dashboard_cards:
                payload = {
                    "toolkit": toolkit.slug,
                    "title": card.title,
                    "body": card.body,
                    "link_text": card.link_text,
                    "link_href": card.link_href,
                    "icon": card.icon,
                }
                metrics = context.get("metrics")
                if metrics:
                    payload["metrics"] = metrics
                cards.append(payload)
        elif context.get("metrics"):
            # Fall back to a generic card when a toolkit reports metrics but no custom card definition.
            cards.append(
                {
                    "toolkit": toolkit.slug,
                    "title": toolkit.name,
                    "body": toolkit.description or "",
                    "link_text": "Open toolkit",
                    "link_href": toolkit.base_path,
                    "icon": None,
                    "metrics": context["metrics"],
                }
            )

    return {
        "jobs": {
            "recent": recent_jobs[:5],
            "totals": {
                "count": total_jobs,
                "by_status": dict(status_counts),
            },
        },
        "cards": cards,
    }
