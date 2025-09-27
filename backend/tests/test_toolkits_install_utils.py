import json
import os
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.toolkits import install_utils
from app.toolkits.install_utils import ToolkitManifestError, _validate_toolkit_tree, install_toolkit_from_directory


def _write_manifest(path: Path, **overrides: str) -> None:
    manifest = {
        "slug": overrides.get("slug", "demo"),
        "name": overrides.get("name", "Demo Toolkit"),
        "description": overrides.get("description", ""),
        "base_path": overrides.get("base_path", "/toolkits/demo"),
    }
    if "version" in overrides:
        manifest["version"] = overrides["version"]
    path.write_text(json.dumps(manifest))


def test_validate_toolkit_tree_rejects_symlink(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    bundle.mkdir()

    nested_dir = bundle / "nested"
    nested_dir.mkdir()
    (nested_dir / "file.txt").write_text("hello")
    (bundle / "toolkit.json").write_text("{}")

    malicious_link = bundle / "link"
    malicious_link.symlink_to(nested_dir / "file.txt")

    with pytest.raises(ToolkitManifestError) as exc_info:
        _validate_toolkit_tree(bundle)

    assert "symbolic links" in str(exc_info.value)


def test_validate_toolkit_tree_rejects_root_symlink(tmp_path: Path) -> None:
    real_root = tmp_path / "real"
    real_root.mkdir()
    (real_root / "toolkit.json").write_text("{}")

    symlink_root = tmp_path / "alias"
    symlink_root.symlink_to(real_root, target_is_directory=True)

    with pytest.raises(ToolkitManifestError) as exc_info:
        _validate_toolkit_tree(symlink_root)

    assert "root may not be a symbolic link" in str(exc_info.value)


@pytest.mark.skipif(os.name == "nt", reason="Named pipes are not supported on Windows")
def test_validate_toolkit_tree_rejects_special_files(tmp_path: Path) -> None:
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    (bundle / "toolkit.json").write_text("{}")

    fifo_path = bundle / "fifo"
    os.mkfifo(fifo_path)

    with pytest.raises(ToolkitManifestError) as exc_info:
        _validate_toolkit_tree(bundle)

    assert "unsupported file type" in str(exc_info.value)


def test_install_toolkit_rejects_destination_escape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(install_utils.settings, "toolkit_storage_dir", storage_dir)

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    _write_manifest(bundle / "toolkit.json", slug="../escape")

    sentinel = MagicMock(side_effect=AssertionError("should not be invoked"))
    monkeypatch.setattr(install_utils, "clear_toolkit_removal", sentinel)
    monkeypatch.setattr(install_utils, "create_toolkit", sentinel)
    monkeypatch.setattr(install_utils, "update_toolkit", sentinel)
    monkeypatch.setattr(install_utils, "activate_toolkit", sentinel)
    monkeypatch.setattr(install_utils, "mark_toolkit_removed", sentinel)

    with pytest.raises(ToolkitManifestError) as exc_info:
        install_toolkit_from_directory(bundle)

    assert "Toolkit slug must" in str(exc_info.value)


def test_install_toolkit_normalises_manifest_slug(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(install_utils.settings, "toolkit_storage_dir", storage_dir)

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    _write_manifest(bundle / "toolkit.json", slug="Demo-Toolkit")
    (bundle / "README.md").write_text("docs")

    monkeypatch.setattr(install_utils, "get_toolkit", lambda slug: None)
    monkeypatch.setattr(install_utils, "clear_toolkit_removal", lambda slug: None)
    monkeypatch.setattr(install_utils, "activate_toolkit", lambda slug: None)
    monkeypatch.setattr(install_utils, "mark_toolkit_removed", lambda slug: None)

    captured_payload = {}

    def _create_toolkit(payload, origin="custom"):
        captured_payload["slug"] = payload.slug
        return install_utils.ToolkitRecord(
            slug=payload.slug,
            name=payload.name,
            description=payload.description or "",
            base_path=payload.base_path,
            enabled=payload.enabled,
            category=payload.category,
            tags=list(payload.tags or []),
            origin=origin,
            version=payload.version,
            backend_module=payload.backend_module,
            backend_router_attr=payload.backend_router_attr,
            worker_module=payload.worker_module,
            worker_register_attr=payload.worker_register_attr,
            dashboard_cards=[],
            dashboard_context_module=payload.dashboard_context_module,
            dashboard_context_attr=payload.dashboard_context_attr,
            frontend_entry=payload.frontend_entry,
            frontend_source_entry=payload.frontend_source_entry,
        )

    monkeypatch.setattr(install_utils, "create_toolkit", _create_toolkit)
    monkeypatch.setattr(install_utils, "update_toolkit", lambda slug, payload: None)

    record = install_toolkit_from_directory(bundle)

    assert captured_payload["slug"] == "demo-toolkit"
    assert record.slug == "demo-toolkit"
    assert (storage_dir / "demo-toolkit").exists()


def test_install_toolkit_captures_version(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(install_utils.settings, "toolkit_storage_dir", storage_dir)

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    _write_manifest(bundle / "toolkit.json", slug="demo", version="1.2.3")

    created: dict[str, Any] = {}

    def _create_toolkit(payload, origin="custom"):
        created["version"] = payload.version
        return install_utils.ToolkitRecord(
            slug=payload.slug,
            name=payload.name,
            description=payload.description or "",
            base_path=payload.base_path,
            enabled=payload.enabled,
            category=payload.category,
            tags=list(payload.tags or []),
            origin=origin,
            version=payload.version,
            backend_module=payload.backend_module,
            backend_router_attr=payload.backend_router_attr,
            worker_module=payload.worker_module,
            worker_register_attr=payload.worker_register_attr,
            dashboard_cards=[],
            dashboard_context_module=payload.dashboard_context_module,
            dashboard_context_attr=payload.dashboard_context_attr,
            frontend_entry=payload.frontend_entry,
            frontend_source_entry=payload.frontend_source_entry,
        )

    monkeypatch.setattr(install_utils, "get_toolkit", lambda slug: None)
    monkeypatch.setattr(install_utils, "create_toolkit", _create_toolkit)
    monkeypatch.setattr(install_utils, "update_toolkit", lambda slug, payload: None)
    monkeypatch.setattr(install_utils, "clear_toolkit_removal", lambda slug: None)
    monkeypatch.setattr(install_utils, "activate_toolkit", lambda slug: None)
    monkeypatch.setattr(install_utils, "mark_toolkit_removed", lambda slug: None)

    record = install_toolkit_from_directory(bundle)

    assert created["version"] == "1.2.3"
    assert record.version == "1.2.3"


def test_install_toolkit_updates_version_for_existing_toolkit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(install_utils.settings, "toolkit_storage_dir", storage_dir)

    bundle = tmp_path / "bundle"
    bundle.mkdir()
    _write_manifest(bundle / "toolkit.json", slug="demo", version="2.0.0")

    existing_record = install_utils.ToolkitRecord(
        slug="demo",
        name="Demo Toolkit",
        description="",
        base_path="/toolkits/demo",
        enabled=True,
        category="toolkit",
        tags=[],
        origin="uploaded",
        version="1.5.0",
        backend_module=None,
        backend_router_attr=None,
        worker_module=None,
        worker_register_attr=None,
        dashboard_cards=[],
        dashboard_context_module=None,
        dashboard_context_attr=None,
        frontend_entry=None,
        frontend_source_entry=None,
    )

    captured_payload: dict[str, Any] = {}

    def _update_toolkit(slug, payload):
        captured_payload["version"] = payload.version
        return install_utils.ToolkitRecord(
            slug=slug,
            name=payload.name or existing_record.name,
            description=payload.description or existing_record.description,
            base_path=payload.base_path or existing_record.base_path,
            enabled=existing_record.enabled,
            category=existing_record.category,
            tags=list(existing_record.tags),
            origin=existing_record.origin,
            version=payload.version,
            backend_module=payload.backend_module,
            backend_router_attr=payload.backend_router_attr,
            worker_module=payload.worker_module,
            worker_register_attr=payload.worker_register_attr,
            dashboard_cards=[],
            dashboard_context_module=payload.dashboard_context_module,
            dashboard_context_attr=payload.dashboard_context_attr,
            frontend_entry=payload.frontend_entry,
            frontend_source_entry=payload.frontend_source_entry,
        )

    monkeypatch.setattr(install_utils, "get_toolkit", lambda slug: existing_record)
    monkeypatch.setattr(install_utils, "update_toolkit", _update_toolkit)
    monkeypatch.setattr(install_utils, "create_toolkit", lambda payload, origin="custom": None)
    monkeypatch.setattr(install_utils, "clear_toolkit_removal", lambda slug: None)
    monkeypatch.setattr(install_utils, "activate_toolkit", lambda slug: None)
    monkeypatch.setattr(install_utils, "mark_toolkit_removed", lambda slug: None)

    record = install_toolkit_from_directory(bundle)

    assert captured_payload["version"] == "2.0.0"
    assert record.version == "2.0.0"
