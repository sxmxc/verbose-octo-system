from __future__ import annotations

from pathlib import Path

from ..config import settings
from .install_utils import install_toolkit_from_directory
from .registry import get_toolkit, set_toolkit_origin


_BUNDLED_TOOLKITS = {
    "zabbix": Path(__file__).resolve().parents[3] / "toolkits" / "bundled" / "zabbix",
    "regex": Path(__file__).resolve().parents[3] / "toolkits" / "bundled" / "regex",
}


def _sentinel_path(slug: str) -> Path:
    return Path(settings.toolkit_storage_dir) / f".bundled-removed-{slug}"


def ensure_bundled_toolkits_installed() -> None:
    for slug, source_dir in _BUNDLED_TOOLKITS.items():
        if not source_dir.exists():
            continue
        if _sentinel_path(slug).exists():
            continue
        existing = get_toolkit(slug)
        enabled = True
        if existing:
            enabled = existing.enabled
            if existing.origin != "bundled":
                set_toolkit_origin(slug, "bundled")
        install_toolkit_from_directory(
            source_dir,
            origin="bundled",
            enable_by_default=enabled,
            preserve_enabled=False,
        )
