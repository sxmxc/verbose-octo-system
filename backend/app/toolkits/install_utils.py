from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Optional

from ..config import settings
from ..toolkit_loader import activate_toolkit, mark_toolkit_removed
from .registry import (
    ToolkitCreate,
    ToolkitDashboardCard,
    ToolkitRecord,
    ToolkitUpdate,
    create_toolkit,
    get_toolkit,
    update_toolkit,
)


class ToolkitManifestError(ValueError):
    pass


def load_manifest(path: Path) -> dict:
    if not path.exists():
        raise ToolkitManifestError("toolkit.json manifest not found")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:  # pragma: no cover - sanity gate
        raise ToolkitManifestError(f"Invalid toolkit.json: {exc}") from exc


def install_toolkit_from_directory(
    source_dir: Path,
    *,
    slug_override: Optional[str] = None,
    origin: str = "uploaded",
    enable_by_default: bool = True,
    preserve_enabled: bool = True,
) -> ToolkitRecord:
    manifest_path = source_dir / "toolkit.json"
    manifest = load_manifest(manifest_path)

    manifest_slug = manifest.get("slug")
    if not manifest_slug:
        raise ToolkitManifestError("toolkit.json must define a slug")
    manifest_slug = manifest_slug.strip().lower()

    if slug_override:
        slug = slug_override.strip().lower()
        if slug != manifest_slug:
            raise ToolkitManifestError("Manifest slug does not match override")
    else:
        slug = manifest_slug

    name = manifest.get("name", slug.replace("-", " ").title())
    description = manifest.get("description", "")
    base_path = manifest.get("base_path", f"/toolkits/{slug}")
    if not base_path.startswith("/"):
        base_path = "/" + base_path.lstrip("/")

    backend_manifest = manifest.get("backend", {})
    backend_module = backend_manifest.get("module")
    backend_router_attr = backend_manifest.get("router_attr")

    worker_manifest = manifest.get("worker", {})
    worker_module = worker_manifest.get("module")
    worker_register_attr = worker_manifest.get("register_attr")

    cards_data = manifest.get("dashboard_cards", [])
    dashboard_cards = []
    for card in cards_data:
        try:
            dashboard_cards.append(ToolkitDashboardCard(**card))
        except Exception as exc:  # pragma: no cover - manifest validation guard
            raise ToolkitManifestError(f"Invalid dashboard card: {exc}") from exc

    dashboard_manifest = manifest.get("dashboard", {})
    dashboard_context_module = dashboard_manifest.get("module")
    dashboard_context_attr = dashboard_manifest.get("callable") or dashboard_manifest.get("attr")

    # Copy bundle to storage
    storage_dir = Path(settings.toolkit_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    dest_root = storage_dir / slug
    if dest_root.exists():
        shutil.rmtree(dest_root)
    shutil.copytree(source_dir, dest_root)

    sentinel = storage_dir / f".bundled-removed-{slug}"
    if sentinel.exists():
        sentinel.unlink(missing_ok=True)

    payload = ToolkitCreate(
        slug=slug,
        name=name,
        description=description,
        base_path=base_path,
        enabled=enable_by_default,
        backend_module=backend_module,
        backend_router_attr=backend_router_attr,
        worker_module=worker_module,
        worker_register_attr=worker_register_attr,
        dashboard_cards=dashboard_cards,
        dashboard_context_module=dashboard_context_module,
        dashboard_context_attr=dashboard_context_attr,
    )

    existing = get_toolkit(slug)
    if existing:
        update_payload = ToolkitUpdate(
            name=name,
            description=description,
            base_path=base_path,
            backend_module=backend_module,
            backend_router_attr=backend_router_attr,
            worker_module=worker_module,
            worker_register_attr=worker_register_attr,
            dashboard_cards=dashboard_cards,
        )
        update_payload.dashboard_context_module = dashboard_context_module
        update_payload.dashboard_context_attr = dashboard_context_attr
        if not preserve_enabled:
            update_payload.enabled = payload.enabled

        toolkit = update_toolkit(slug, update_payload)
        if toolkit is None:
            toolkit = get_toolkit(slug)
    else:
        toolkit = create_toolkit(payload, origin=origin)

    if toolkit and toolkit.enabled:
        mark_toolkit_removed(slug)
        activate_toolkit(slug)

    if not toolkit:
        raise ToolkitManifestError("Failed to install toolkit")

    return toolkit
