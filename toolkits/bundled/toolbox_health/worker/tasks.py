
"""Worker integration for the Toolbox Health toolkit."""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, Optional

from ..backend.health import build_health_summary_sync, get_cached_summary


LOGGER = logging.getLogger(__name__)
_REFRESH_INTERVAL_SECONDS = 60
_REFRESH_TASK_NAME = "toolkits.toolbox_health.refresh_snapshot"


def _refresh_snapshot() -> Dict[str, Any]:
    summary = build_health_summary_sync()
    return summary.model_dump(mode="json")


def register(
    celery_app: Any,
    register_handler: Optional[Callable[[str, Callable[[Dict[str, Any]], Dict[str, Any]]], None]] = None,
    **_: Any,
) -> None:
    """Register background health refresh jobs with the worker."""

    _ = register_handler  # interface compatibility; no synchronous jobs required yet

    @celery_app.task(name=_REFRESH_TASK_NAME, bind=True)
    def refresh_toolbox_health_snapshot(task_self) -> Dict[str, Any]:
        try:
            result = _refresh_snapshot()
            LOGGER.debug("Updated toolbox health snapshot via task %s", task_self.request.id)
            return result
        except Exception as exc:  # pragma: no cover - defensive guard
            LOGGER.exception("Failed to refresh toolbox health snapshot: %s", exc)
            raise

    def _schedule_periodic_refresh(sender, **kwargs):  # pragma: no cover - celery hook
        sender.add_periodic_task(
            _REFRESH_INTERVAL_SECONDS,
            refresh_toolbox_health_snapshot.s(),
            name="toolbox-health.refresh-snapshot",
            expires=_REFRESH_INTERVAL_SECONDS,
        )

    celery_app.on_after_finalize.connect(_schedule_periodic_refresh, weak=False)

    if not get_cached_summary():
        try:
            _refresh_snapshot()
        except Exception as exc:  # pragma: no cover - defensive guard
            LOGGER.warning("Initial health snapshot failed: %s", exc)


__all__ = ["register"]

