from __future__ import annotations

import json
import shutil
import stat
from pathlib import Path
from typing import Optional

from ..config import settings
from ..toolkit_loader import activate_toolkit, mark_toolkit_removed
from .registry import (
    ToolkitCreate,
    ToolkitDashboardCard,
    ToolkitRecord,
    ToolkitUpdate,
    clear_toolkit_removal,
    create_toolkit,
    get_toolkit,
    update_toolkit,
)
from .slugs import InvalidToolkitSlugError, normalise_slug


class ToolkitManifestError(ValueError):
    pass


def _is_noise_directory(path: Path) -> bool:
    name = path.name
    return name.startswith("__MACOSX") or name.startswith(".")


def _resolve_toolkit_root(source_dir: Path) -> Path:
    manifest_path = source_dir / "toolkit.json"
    if manifest_path.exists():
        return source_dir

    candidates = []
    for child in source_dir.iterdir() if source_dir.exists() else []:
        if not child.is_dir():
            continue
        if _is_noise_directory(child):
            continue
        candidate_manifest = child / "toolkit.json"
        if candidate_manifest.exists():
            candidates.append(child)

    if len(candidates) == 1:
        return candidates[0]

    raise ToolkitManifestError("toolkit.json manifest not found")


def load_manifest(path: Path) -> dict:
    if not path.exists():
        raise ToolkitManifestError("toolkit.json manifest not found")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:  # pragma: no cover - sanity gate
        raise ToolkitManifestError(f"Invalid toolkit.json: {exc}") from exc


def _validate_toolkit_tree(toolkit_root: Path) -> None:
    if not toolkit_root.exists() or not toolkit_root.is_dir():
        raise ToolkitManifestError("Toolkit root is not a directory")
    if toolkit_root.is_symlink():
        raise ToolkitManifestError("Toolkit root may not be a symbolic link")

    root_resolved = toolkit_root.resolve()

    for entry in toolkit_root.rglob("*"):
        if entry.is_symlink():
            raise ToolkitManifestError(f"Toolkit bundle may not contain symbolic links (found: {entry.name})")

        resolved_entry = entry.resolve()
        try:
            resolved_entry.relative_to(root_resolved)
        except ValueError as exc:
            raise ToolkitManifestError(f"Toolkit bundle contains entry outside the root: {entry}") from exc

        if entry.is_dir():
            continue

        entry_mode = entry.stat().st_mode
        if not stat.S_ISREG(entry_mode):
            raise ToolkitManifestError(
                f"Toolkit bundle contains unsupported file type: {entry.relative_to(toolkit_root)}"
            )


def install_toolkit_from_directory(
    source_dir: Path,
    *,
    slug_override: Optional[str] = None,
    origin: str = "uploaded",
    enable_by_default: bool = True,
    preserve_enabled: bool = True,
) -> ToolkitRecord:
    toolkit_root = _resolve_toolkit_root(source_dir)
    manifest_path = toolkit_root / "toolkit.json"
    manifest = load_manifest(manifest_path)

    manifest_slug_raw = manifest.get("slug")
    if not manifest_slug_raw:
        raise ToolkitManifestError("toolkit.json must define a slug")
    try:
        manifest_slug = normalise_slug(manifest_slug_raw)
    except InvalidToolkitSlugError as exc:
        raise ToolkitManifestError(str(exc)) from exc

    if slug_override:
        try:
            slug = normalise_slug(slug_override)
        except InvalidToolkitSlugError as exc:
            raise ToolkitManifestError(str(exc)) from exc
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

    frontend_manifest = manifest.get("frontend", {}) or {}

    def _normalize_frontend_path(value: str | None) -> str | None:
        if not value:
            return None
        return Path(value).as_posix()

    raw_frontend_entry = frontend_manifest.get("entry")
    frontend_entry = _normalize_frontend_path(raw_frontend_entry)
    default_entry = Path("frontend") / "dist" / "index.js"
    if not frontend_entry and (toolkit_root / default_entry).exists():
        frontend_entry = default_entry.as_posix()
    if frontend_entry and not (toolkit_root / Path(frontend_entry)).exists():
        raise ToolkitManifestError(
            f"Frontend entry '{frontend_entry}' declared in toolkit.json was not found in the bundle"
        )

    raw_source_entry = frontend_manifest.get("source_entry")
    frontend_source_entry = _normalize_frontend_path(raw_source_entry)
    default_source_entry = Path("frontend") / "index.tsx"
    if not frontend_source_entry and (toolkit_root / default_source_entry).exists():
        frontend_source_entry = default_source_entry.as_posix()
    if frontend_source_entry and not (toolkit_root / Path(frontend_source_entry)).exists():
        raise ToolkitManifestError(
            f"Frontend source entry '{frontend_source_entry}' declared in toolkit.json was not found in the bundle"
        )

    # Copy bundle to storage
    _validate_toolkit_tree(toolkit_root)

    storage_dir = Path(settings.toolkit_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_dir_resolved = storage_dir.resolve()

    dest_root = storage_dir / slug
    dest_root_resolved = dest_root.resolve()
    try:
        dest_root_resolved.relative_to(storage_dir_resolved)
    except ValueError as exc:
        raise ToolkitManifestError("Toolkit storage destination escapes configured storage directory") from exc

    if dest_root.exists():
        shutil.rmtree(dest_root)
    shutil.copytree(toolkit_root, dest_root, dirs_exist_ok=True)

    clear_toolkit_removal(slug)

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
        frontend_entry=frontend_entry,
        frontend_source_entry=frontend_source_entry,
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
        update_payload.frontend_entry = frontend_entry
        update_payload.frontend_source_entry = frontend_source_entry
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
