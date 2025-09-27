from __future__ import annotations

from pathlib import Path

from .install_utils import ToolkitManifestError, install_toolkit_from_directory, load_manifest
from .registry import get_toolkit, is_toolkit_removed, set_toolkit_origin
from .slugs import InvalidToolkitSlugError, normalise_slug


def _discover_bundled_toolkits() -> dict[str, Path]:
    current = Path(__file__).resolve()
    for parent in current.parents:
        bundled_root = parent / "toolkits" / "bundled"
        if bundled_root.exists():
            mapping: dict[str, Path] = {}
            for candidate in bundled_root.iterdir():
                if not candidate.is_dir():
                    continue
                manifest_path = candidate / "toolkit.json"
                if not manifest_path.exists():
                    continue
                try:
                    manifest = load_manifest(manifest_path)
                except ToolkitManifestError:
                    continue
                slug_raw = manifest.get("slug")
                if not slug_raw:
                    continue
                try:
                    slug = normalise_slug(slug_raw)
                except InvalidToolkitSlugError:
                    continue
                mapping[slug] = candidate
            return mapping
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
