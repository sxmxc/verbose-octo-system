"""Worker registration for the Toolbox Health toolkit."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional


def register(
    celery_app: Any,
    register_handler: Optional[Callable[[str, Callable[[Dict[str, Any]], Dict[str, Any]]], None]] = None,
    **_: Any,
) -> None:
    """Expose a no-op register hook so the loader can import the worker module.

    The health toolkit runs checks on-demand and does not schedule background jobs,
    but providing this callable keeps the loader happy and leaves room for future
    asynchronous probes if needed.
    """

    return None


__all__ = ["register"]

