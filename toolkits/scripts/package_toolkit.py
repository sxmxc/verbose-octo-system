#!/usr/bin/env python3
"""Validate and package a toolkit directory into a zip archive."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

IGNORED_DIRS = {".git", "__pycache__", "node_modules", ".pytest_cache"}
IGNORED_FILES = {".DS_Store"}


class PackagingError(RuntimeError):
    """Raised when the toolkit cannot be packaged due to validation issues."""


def load_manifest(root: Path) -> dict:
    manifest_path = root / "toolkit.json"
    if not manifest_path.exists():
        raise PackagingError(f"Missing toolkit.json in {root}")
    try:
        return json.loads(manifest_path.read_text())
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive guard
        raise PackagingError(f"Invalid toolkit.json: {exc}") from exc


def ensure_path(root: Path, relative: str | None, description: str) -> None:
    if not relative:
        return
    candidate = root / Path(relative)
    if not candidate.exists():
        raise PackagingError(f"{description} '{relative}' declared in toolkit.json is missing")


def validate_frontend(root: Path, manifest: dict) -> None:
    frontend = manifest.get("frontend") or {}
    entry = frontend.get("entry")
    source_entry = frontend.get("source_entry")

    if entry:
        ensure_path(root, entry, "frontend.entry")
    else:
        default_entry = Path("frontend") / "dist" / "index.js"
        if (root / default_entry).exists():
            entry = default_entry.as_posix()
        else:
            entry = None

    if source_entry:
        ensure_path(root, source_entry, "frontend.source_entry")

    if entry is None:
        print("[info] no frontend bundle detected; skipping UI validation")


def iter_files(root: Path) -> list[tuple[Path, Path]]:
    records: list[tuple[Path, Path]] = []
    root_name = root.name
    for dirpath, dirnames, filenames in os.walk(root):
        path_obj = Path(dirpath)
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
        for filename in filenames:
            if filename in IGNORED_FILES:
                continue
            full_path = path_obj / filename
            relative = full_path.relative_to(root)
            arcname = Path(root_name) / relative
            records.append((full_path, arcname))
    return records


def package_toolkit(root: Path, output: Path, overwrite: bool) -> None:
    manifest = load_manifest(root)
    slug = (manifest.get("slug") or "toolkit").strip().lower()
    if not slug:
        raise PackagingError("toolkit.json must include a slug")

    validate_frontend(root, manifest)

    if output.exists() and not overwrite:
        raise PackagingError(f"Output {output} already exists. Use --force to overwrite.")

    files = iter_files(root)
    if not files:
        raise PackagingError("No files found to package")

    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, mode="w", compression=ZIP_DEFLATED) as archive:
        for source, arcname in files:
            archive.write(source, arcname)

    print(f"Packaged toolkit '{slug}' to {output}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package a toolkit directory")
    parser.add_argument("toolkit", type=Path, help="Path to the toolkit root")
    parser.add_argument(
        "--output",
        type=Path,
        help="Destination zip path (default: <slug>_toolkit.zip next to the toolkit)",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite the output file if it exists")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    toolkit_path: Path = args.toolkit.resolve()
    if not toolkit_path.exists():
        print(f"error: toolkit path '{toolkit_path}' does not exist", file=sys.stderr)
        return 1

    try:
        manifest = load_manifest(toolkit_path)
    except PackagingError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    slug = (manifest.get("slug") or "toolkit").strip().lower() or "toolkit"
    default_output = toolkit_path.parent / f"{slug}_toolkit.zip"
    output_path = (args.output or default_output).resolve()

    try:
        package_toolkit(toolkit_path, output_path, args.force)
    except PackagingError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
