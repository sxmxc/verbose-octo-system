from __future__ import annotations

import asyncio
import textwrap
from datetime import datetime, timezone
from time import perf_counter
from typing import Iterable, List

import httpx
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.app.config import settings
from backend.app.db.session import SessionLocal
from backend.app.worker_client import celery_app

from .models import ComponentHealth, ComponentName, HealthStatus, HealthSummary


_COMPONENT_ORDER: tuple[ComponentName, ...] = ("frontend", "backend", "worker")
_STATUS_RANK = {
    HealthStatus.HEALTHY: 0,
    HealthStatus.UNKNOWN: 1,
    HealthStatus.DEGRADED: 2,
    HealthStatus.DOWN: 3,
}


def _short_error(exc: Exception) -> str:
    message = str(exc).strip() or exc.__class__.__name__
    return textwrap.shorten(message, width=160, placeholder="…")


async def _check_backend() -> ComponentHealth:
    started = perf_counter()
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        latency = (perf_counter() - started) * 1000
        return ComponentHealth(
            component="backend",
            status=HealthStatus.HEALTHY,
            message="Database connectivity verified.",
            latency_ms=round(latency, 2),
        )
    except SQLAlchemyError as exc:
        return ComponentHealth(
            component="backend",
            status=HealthStatus.DOWN,
            message=f"Database check failed: {_short_error(exc)}",
        )
    except Exception as exc:  # pragma: no cover - defensive guard
        return ComponentHealth(
            component="backend",
            status=HealthStatus.DOWN,
            message=f"Unhandled backend check error: {_short_error(exc)}",
        )


async def _check_worker(timeout: float = 2.0) -> ComponentHealth:
    started = perf_counter()
    try:
        replies = await asyncio.to_thread(celery_app.control.ping, timeout=timeout)
    except Exception as exc:
        return ComponentHealth(
            component="worker",
            status=HealthStatus.DOWN,
            message=f"Celery ping failed: {_short_error(exc)}",
        )

    latency = (perf_counter() - started) * 1000
    reply_count = len(replies or [])
    if reply_count == 0:
        return ComponentHealth(
            component="worker",
            status=HealthStatus.DEGRADED,
            message="No Celery workers responded within timeout.",
            latency_ms=round(latency, 2),
        )

    worker_names = sorted(item for reply in replies for item in reply.keys())
    detail = ", ".join(worker_names)
    message = "1 worker responding" if reply_count == 1 else f"{reply_count} workers responding"
    return ComponentHealth(
        component="worker",
        status=HealthStatus.HEALTHY,
        message=f"{message}: {detail}",
        latency_ms=round(latency, 2),
        details={"workers": worker_names},
    )


async def _check_frontend() -> ComponentHealth:
    base_url = settings.frontend_base_url
    if not base_url:
        return ComponentHealth(
            component="frontend",
            status=HealthStatus.HEALTHY,
            message="No external frontend URL configured; assuming co-hosted UI.",
        )

    url = str(base_url)
    started = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(2.5)) as client:
            response = await client.get(url, headers={"Accept": "text/html"})
    except Exception as exc:
        return ComponentHealth(
            component="frontend",
            status=HealthStatus.DOWN,
            message=f"Request to frontend failed: {_short_error(exc)}",
            details={"frontend_base_url": url},
        )

    latency = (perf_counter() - started) * 1000
    status = HealthStatus.HEALTHY if response.status_code < 400 else HealthStatus.DEGRADED
    message = (
        f"Responded with HTTP {response.status_code}."
        if status is HealthStatus.HEALTHY
        else f"Returned HTTP {response.status_code}; investigate load balancer or app logs."
    )
    return ComponentHealth(
        component="frontend",
        status=status,
        message=message,
        latency_ms=round(latency, 2),
        details={"frontend_base_url": url, "status_code": response.status_code},
    )


async def gather_component_health() -> List[ComponentHealth]:
    checks = {
        "frontend": _check_frontend(),
        "backend": _check_backend(),
        "worker": _check_worker(),
    }
    results = await asyncio.gather(*checks.values())
    mapping = {result.component: result for result in results}
    return [mapping[component] for component in _COMPONENT_ORDER if component in mapping]


def _overall_status(components: Iterable[ComponentHealth]) -> HealthStatus:
    worst = HealthStatus.HEALTHY
    for component in components:
        if _STATUS_RANK[component.status] > _STATUS_RANK[worst]:
            worst = component.status
    return worst


def _summary_notes(status: HealthStatus) -> str:
    if status is HealthStatus.HEALTHY:
        return "All core services responded within acceptable thresholds."
    if status is HealthStatus.DEGRADED:
        return "At least one component responded slowly or returned a warning state."
    if status is HealthStatus.DOWN:
        return "Immediate attention required: one or more services failed health checks."
    return "Component health is inconclusive; verify configuration manually."


async def build_health_summary() -> HealthSummary:
    components = await gather_component_health()
    checked_at = max((component.checked_at for component in components), default=datetime.now(timezone.utc))
    overall = _overall_status(components)
    return HealthSummary(
        overall_status=overall,
        checked_at=checked_at,
        components=components,
        notes=_summary_notes(overall),
    )


def build_health_summary_sync() -> HealthSummary:
    """Synchronous helper for dashboard context builders."""

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():  # pragma: no cover - defensive guard
        raise RuntimeError("build_health_summary_sync must not run inside an active event loop")

    return asyncio.run(build_health_summary())

