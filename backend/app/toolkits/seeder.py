from __future__ import annotations

from pathlib import Path

from .install_utils import install_toolkit_from_directory
from .registry import get_toolkit, is_toolkit_removed, set_toolkit_origin


def _resolve_bundled_path(slug: str) -> Path | None:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "toolkits" / "bundled" / slug
        if candidate.exists():
            return candidate
    return None


_BUNDLED_TOOLKITS = {
    slug: path
    for slug in ("zabbix", "regex")
    if (path := _resolve_bundled_path(slug)) is not None
}


def ensure_bundled_toolkits_installed() -> None:
    for slug, source_dir in _BUNDLED_TOOLKITS.items():
        if not source_dir.exists():
            continue
        if is_toolkit_removed(slug):
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
