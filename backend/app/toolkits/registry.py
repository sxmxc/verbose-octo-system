from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.redis import get_redis, redis_key
from ..db.session_sync import get_sync_session
from ..models.toolkit import Toolkit, ToolkitRemoval


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


def _dump_dashboard_cards(cards: List[ToolkitDashboardCard]) -> List[dict[str, Any]]:
    return [card.model_dump(exclude_none=True) for card in cards]


def _serialize(toolkit: ToolkitRecord) -> str:
    return toolkit.model_dump_json()


def _deserialize(raw: str) -> ToolkitRecord:
    return ToolkitRecord.model_validate_json(raw)


def _record_from_model(model: Toolkit) -> ToolkitRecord:
    return ToolkitRecord(
        slug=model.slug,
        name=model.name,
        description=model.description or "",
        base_path=model.base_path,
        enabled=model.enabled,
        category=model.category,
        tags=list(model.tags or []),
        origin=model.origin,
        backend_module=model.backend_module,
        backend_router_attr=model.backend_router_attr,
        worker_module=model.worker_module,
        worker_register_attr=model.worker_register_attr,
        dashboard_cards=_normalize_dashboard_cards(model.dashboard_cards or []),
        dashboard_context_module=model.dashboard_context_module,
        dashboard_context_attr=model.dashboard_context_attr,
        frontend_entry=model.frontend_entry,
        frontend_source_entry=model.frontend_source_entry,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _cache_toolkit(toolkit: ToolkitRecord) -> None:
    redis = get_redis()
    redis.hset(REGISTRY_KEY, toolkit.slug, _serialize(toolkit))


def _cache_toolkits(toolkits: Iterable[ToolkitRecord]) -> None:
    redis = get_redis()
    mapping = {toolkit.slug: _serialize(toolkit) for toolkit in toolkits}
    if mapping:
        redis.hset(REGISTRY_KEY, mapping=mapping)
    else:
        redis.delete(REGISTRY_KEY)


def _evict_toolkit(slug: str) -> None:
    get_redis().hdel(REGISTRY_KEY, slug)


def _record_removal(session: Session, slug: str) -> None:
    removal = session.get(ToolkitRemoval, slug)
    now = datetime.now(timezone.utc)
    if removal:
        removal.removed_at = now
    else:
        session.add(ToolkitRemoval(slug=slug, removed_at=now))


def _clear_removal(session: Session, slug: str) -> bool:
    result = session.execute(delete(ToolkitRemoval).where(ToolkitRemoval.slug == slug))
    return bool(result.rowcount)


def _apply_record(model: Toolkit, record: ToolkitRecord) -> bool:
    updated = False
    data = {
        "name": record.name,
        "description": record.description or "",
        "base_path": record.base_path,
        "enabled": record.enabled,
        "category": record.category,
        "tags": list(record.tags or []),
        "origin": record.origin,
        "backend_module": record.backend_module,
        "backend_router_attr": record.backend_router_attr,
        "worker_module": record.worker_module,
        "worker_register_attr": record.worker_register_attr,
        "dashboard_cards": _dump_dashboard_cards(record.dashboard_cards),
        "dashboard_context_module": record.dashboard_context_module,
        "dashboard_context_attr": record.dashboard_context_attr,
        "frontend_entry": record.frontend_entry,
        "frontend_source_entry": record.frontend_source_entry,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
    for field, value in data.items():
        if getattr(model, field) != value:
            setattr(model, field, value)
            updated = True
    return updated


def _persist_records(records: Iterable[ToolkitRecord]) -> None:
    records = list(records)
    if not records:
        return
    with get_sync_session() as session:
        dirty = False
        for record in records:
            model = session.get(Toolkit, record.slug)
            if model is None:
                model = Toolkit(slug=record.slug)
                session.add(model)
                dirty = True
            if _apply_record(model, record):
                dirty = True
            if _clear_removal(session, record.slug):
                dirty = True
        if dirty:
            session.commit()


def _ensure_persisted(record: ToolkitRecord) -> None:
    _persist_records([record])


def list_toolkits() -> List[ToolkitRecord]:
    redis = get_redis()
    values = redis.hvals(REGISTRY_KEY)
    if values:
        toolkits = [_deserialize(value) for value in values]
        _persist_records(toolkits)
    else:
        with get_sync_session() as session:
            models = session.scalars(select(Toolkit)).all()
        toolkits = [_record_from_model(model) for model in models]
        _cache_toolkits(toolkits)
    toolkits.sort(key=lambda item: (item.category, item.name.lower()))
    return toolkits


def get_toolkit(slug: str) -> Optional[ToolkitRecord]:
    redis = get_redis()
    raw = redis.hget(REGISTRY_KEY, slug)
    if raw:
        record = _deserialize(raw)
        _ensure_persisted(record)
        return record
    with get_sync_session() as session:
        model = session.get(Toolkit, slug)
        if not model:
            return None
        record = _record_from_model(model)
    _cache_toolkit(record)
    return record


def upsert_toolkit(payload: ToolkitCreate, origin: str = "builtin") -> ToolkitRecord:
    existing = get_toolkit(payload.slug)
    if existing:
        return existing
    return create_toolkit(payload, origin=origin)


def create_toolkit(payload: ToolkitCreate, origin: str = "custom") -> ToolkitRecord:
    normalized_cards = _normalize_dashboard_cards(payload.dashboard_cards)
    with get_sync_session() as session:
        if session.get(Toolkit, payload.slug):
            raise ValueError(f"Toolkit '{payload.slug}' already exists")
        model = Toolkit(
            slug=payload.slug,
            name=payload.name,
            description=payload.description or "",
            base_path=payload.base_path,
            enabled=payload.enabled,
            category=payload.category,
            tags=list(payload.tags or []),
            origin=origin,
            backend_module=payload.backend_module,
            backend_router_attr=payload.backend_router_attr,
            worker_module=payload.worker_module,
            worker_register_attr=payload.worker_register_attr,
            dashboard_cards=_dump_dashboard_cards(normalized_cards),
            dashboard_context_module=payload.dashboard_context_module,
            dashboard_context_attr=payload.dashboard_context_attr,
            frontend_entry=payload.frontend_entry,
            frontend_source_entry=payload.frontend_source_entry,
        )
        model.created_at = datetime.now(timezone.utc)
        model.updated_at = model.created_at
        session.add(model)
        _clear_removal(session, payload.slug)
        session.commit()
        session.refresh(model)
        record = _record_from_model(model)
    _cache_toolkit(record)
    return record


def update_toolkit(slug: str, payload: ToolkitUpdate) -> Optional[ToolkitRecord]:
    update_data = payload.model_dump(exclude_unset=True)
    with get_sync_session() as session:
        model = session.get(Toolkit, slug)
        if not model:
            return None
        if "dashboard_cards" in update_data:
            normalized_cards = _normalize_dashboard_cards(payload.dashboard_cards)
            update_data["dashboard_cards"] = _dump_dashboard_cards(normalized_cards)
        for field, value in update_data.items():
            setattr(model, field, value)
        model.updated_at = datetime.now(timezone.utc)
        session.add(model)
        session.commit()
        session.refresh(model)
        record = _record_from_model(model)
    _cache_toolkit(record)
    return record


def delete_toolkit(slug: str) -> bool:
    with get_sync_session() as session:
        model = session.get(Toolkit, slug)
        if not model:
            return False
        if model.origin == "builtin":
            raise ValueError("Cannot delete builtin toolkit")
        was_bundled = model.origin == "bundled"
        session.delete(model)
        if was_bundled:
            _record_removal(session, slug)
        else:
            _clear_removal(session, slug)
        session.commit()
    _evict_toolkit(slug)
    return True


def set_toolkit_origin(slug: str, origin: str) -> Optional[ToolkitRecord]:
    with get_sync_session() as session:
        model = session.get(Toolkit, slug)
        if not model:
            return None
        model.origin = origin
        model.updated_at = datetime.now(timezone.utc)
        session.add(model)
        session.commit()
        session.refresh(model)
        record = _record_from_model(model)
    _cache_toolkit(record)
    return record


def is_toolkit_removed(slug: str) -> bool:
    with get_sync_session() as session:
        return session.get(ToolkitRemoval, slug) is not None


def clear_toolkit_removal(slug: str) -> None:
    with get_sync_session() as session:
        _clear_removal(session, slug)
        session.commit()
