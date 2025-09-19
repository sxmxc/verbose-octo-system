from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import Boolean, DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..db.base import Base


class Toolkit(Base):
    __tablename__ = "toolkits"

    slug: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    base_path: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="toolkit", nullable=False)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    origin: Mapped[str] = mapped_column(String(32), default="custom", nullable=False)
    backend_module: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    backend_router_attr: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    worker_module: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    worker_register_attr: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    dashboard_cards: Mapped[List[dict[str, Any]]] = mapped_column(JSON, default=list)
    dashboard_context_module: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dashboard_context_attr: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    frontend_entry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    frontend_source_entry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ToolkitRemoval(Base):
    __tablename__ = "toolkit_removals"

    slug: Mapped[str] = mapped_column(String(128), primary_key=True)
    removed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


__all__ = ["Toolkit", "ToolkitRemoval"]
