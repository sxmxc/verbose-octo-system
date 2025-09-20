import json
import os
from pathlib import Path
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

    assert "storage directory" in str(exc_info.value)
