from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field

from ..core.redis import get_redis, redis_key


REGISTRY_KEY = redis_key("toolkits", "registry")


class ToolkitDashboardCard(BaseModel):
    title: str
    body: str
    link_text: Optional[str] = None
    link_href: Optional[str] = None
    icon: Optional[str] = None


class ToolkitRecord(BaseModel):
    slug: str = Field(..., description="Unique identifier for the toolkit")
    name: str = Field(..., description="Display name")
    description: str = Field(default="", description="Short summary")
    base_path: str = Field(..., description="Router mount point")
    enabled: bool = Field(default=True, description="Whether the toolkit should appear in navigation")
    category: str = Field(default="toolkit", description="Grouping hint for UI")
    tags: List[str] = Field(default_factory=list)
    origin: str = Field(default="builtin", description="Source of toolkit definition")
    backend_module: str | None = Field(default=None, description="Import path for plugin FastAPI module")
    backend_router_attr: str | None = Field(default=None, description="Attribute on backend module exposing an APIRouter")
    worker_module: str | None = Field(default=None, description="Import path for plugin Celery tasks")
    worker_register_attr: str | None = Field(default=None, description="Callable to register tasks with Celery")
    dashboard_cards: List[ToolkitDashboardCard] = Field(default_factory=list)
    dashboard_context_module: str | None = Field(default=None, description="Import path for dashboard context callable")
    dashboard_context_attr: str | None = Field(default=None, description="Callable name providing dashboard context")
    frontend_entry: str | None = Field(default=None, description="Relative path to the built frontend entry inside the toolkit bundle")
    frontend_source_entry: str | None = Field(default=None, description="Relative path to the source frontend entry used during development")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ToolkitCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    base_path: str
    enabled: bool = True
    category: str = "toolkit"
    tags: List[str] = Field(default_factory=list)
    backend_module: Optional[str] = None
    backend_router_attr: Optional[str] = None
    worker_module: Optional[str] = None
    worker_register_attr: Optional[str] = None
    dashboard_cards: List[ToolkitDashboardCard] = Field(default_factory=list)
    dashboard_context_module: Optional[str] = None
    dashboard_context_attr: Optional[str] = None
    frontend_entry: Optional[str] = None
    frontend_source_entry: Optional[str] = None


class ToolkitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_path: Optional[str] = None
    enabled: Optional[bool] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    backend_module: Optional[str] = None
    backend_router_attr: Optional[str] = None
    worker_module: Optional[str] = None
    worker_register_attr: Optional[str] = None
    dashboard_cards: Optional[List[ToolkitDashboardCard]] = None
    dashboard_context_module: Optional[str] = None
    dashboard_context_attr: Optional[str] = None
    frontend_entry: Optional[str] = None
    frontend_source_entry: Optional[str] = None


def _normalize_dashboard_cards(cards: List[ToolkitDashboardCard] | List[dict] | None) -> List[ToolkitDashboardCard]:
    if not cards:
        return []
    normalized: List[ToolkitDashboardCard] = []
    for card in cards:
        if isinstance(card, ToolkitDashboardCard):
            normalized.append(card)
        else:
            normalized.append(ToolkitDashboardCard(**card))
    return normalized


def _serialize(toolkit: ToolkitRecord) -> str:
    return toolkit.model_dump_json()


def _deserialize(raw: str) -> ToolkitRecord:
    return ToolkitRecord.model_validate_json(raw)


def list_toolkits() -> List[ToolkitRecord]:
    redis = get_redis()
    values = redis.hvals(REGISTRY_KEY)
    toolkits = [_deserialize(value) for value in values]
    toolkits.sort(key=lambda item: (item.category, item.name.lower()))
    return toolkits


def get_toolkit(slug: str) -> Optional[ToolkitRecord]:
    redis = get_redis()
    raw = redis.hget(REGISTRY_KEY, slug)
    if not raw:
        return None
    return _deserialize(raw)


def upsert_toolkit(payload: ToolkitCreate, origin: str = "builtin") -> ToolkitRecord:
    existing = get_toolkit(payload.slug)
    if existing:
        return existing
    toolkit = ToolkitRecord(
        slug=payload.slug,
        name=payload.name,
        description=payload.description or "",
        base_path=payload.base_path,
        enabled=payload.enabled,
        category=payload.category,
        tags=payload.tags,
        origin=origin,
        backend_module=payload.backend_module,
        backend_router_attr=payload.backend_router_attr,
        worker_module=payload.worker_module,
        worker_register_attr=payload.worker_register_attr,
        dashboard_cards=_normalize_dashboard_cards(payload.dashboard_cards),
        dashboard_context_module=payload.dashboard_context_module,
        dashboard_context_attr=payload.dashboard_context_attr,
        frontend_entry=payload.frontend_entry,
        frontend_source_entry=payload.frontend_source_entry,
    )
    _save(toolkit)
    return toolkit


def create_toolkit(payload: ToolkitCreate, origin: str = "custom") -> ToolkitRecord:
    if get_toolkit(payload.slug):
        raise ValueError(f"Toolkit '{payload.slug}' already exists")
    toolkit = ToolkitRecord(
        slug=payload.slug,
        name=payload.name,
        description=payload.description or "",
        base_path=payload.base_path,
        enabled=payload.enabled,
        category=payload.category,
        tags=payload.tags,
        origin=origin,
        backend_module=payload.backend_module,
        backend_router_attr=payload.backend_router_attr,
        worker_module=payload.worker_module,
        worker_register_attr=payload.worker_register_attr,
        dashboard_cards=_normalize_dashboard_cards(payload.dashboard_cards),
        dashboard_context_module=payload.dashboard_context_module,
        dashboard_context_attr=payload.dashboard_context_attr,
        frontend_entry=payload.frontend_entry,
        frontend_source_entry=payload.frontend_source_entry,
    )
    _save(toolkit)
    return toolkit


def update_toolkit(slug: str, payload: ToolkitUpdate) -> Optional[ToolkitRecord]:
    toolkit = get_toolkit(slug)
    if not toolkit:
        return None
    update_data = payload.model_dump(exclude_unset=True)
    if "dashboard_cards" in update_data:
        update_data["dashboard_cards"] = _normalize_dashboard_cards(payload.dashboard_cards)
    if not update_data:
        return toolkit
    toolkit = toolkit.model_copy(update=update_data)
    toolkit.updated_at = datetime.now(timezone.utc)
    _save(toolkit)
    return toolkit


def delete_toolkit(slug: str) -> bool:
    toolkit = get_toolkit(slug)
    if not toolkit:
        return False
    if toolkit.origin == "builtin":
        raise ValueError("Cannot delete builtin toolkit")
    redis = get_redis()
    return bool(redis.hdel(REGISTRY_KEY, slug))


def set_toolkit_origin(slug: str, origin: str) -> Optional[ToolkitRecord]:
    toolkit = get_toolkit(slug)
    if not toolkit:
        return None
    toolkit.origin = origin
    toolkit.updated_at = datetime.now(timezone.utc)
    _save(toolkit)
    return toolkit


def _save(toolkit: ToolkitRecord) -> None:
    redis = get_redis()
    redis.hset(REGISTRY_KEY, toolkit.slug, _serialize(toolkit))
