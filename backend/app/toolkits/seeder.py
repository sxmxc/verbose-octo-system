from __future__ import annotations

from pathlib import Path

from .install_utils import install_toolkit_from_directory
from .registry import get_toolkit, is_toolkit_removed, set_toolkit_origin


def _discover_bundled_toolkits() -> dict[str, Path]:
    current = Path(__file__).resolve()
    for parent in current.parents:
        bundled_root = parent / "toolkits" / "bundled"
        if bundled_root.exists():
            return {
                candidate.name: candidate
                for candidate in bundled_root.iterdir()
                if candidate.is_dir()
            }
    return {}


_BUNDLED_TOOLKITS = _discover_bundled_toolkits()


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
