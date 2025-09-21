#!/usr/bin/env python3
"""Package every toolkit manifest found under the repository."""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys

from package_toolkit import PackagingError, normalise_slug

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
FRONTEND_ROOT = REPO_ROOT / "frontend"
DEFAULT_TOOLKIT_DIR = REPO_ROOT / "toolkits"
PACKAGE_SCRIPT = REPO_ROOT / "toolkits" / "scripts" / "package_toolkit.py"


def resolve_slug(manifest: dict, toolkit_dir: pathlib.Path) -> str:
    raw_slug = manifest.get("slug")
    if raw_slug is None:
        raise RuntimeError(f"toolkit.json in {toolkit_dir} must include a slug")
    try:
        return normalise_slug(raw_slug)
    except PackagingError as exc:
        raise RuntimeError(f"Invalid slug in {toolkit_dir}: {exc}") from exc


def find_toolkits(base: pathlib.Path) -> list[pathlib.Path]:
    return sorted(path.parent for path in base.rglob("toolkit.json"))


def package_all(toolkits_dir: pathlib.Path, destination: pathlib.Path, overwrite: bool) -> None:
    manifests = find_toolkits(toolkits_dir)
    if not manifests:
        raise SystemExit("No toolkit manifests found.")

    destination.mkdir(parents=True, exist_ok=True)

    for toolkit_dir in manifests:
        manifest_path = toolkit_dir / "toolkit.json"
        with manifest_path.open() as handle:
            manifest = json.load(handle)

        ensure_frontend_bundle(toolkit_dir, manifest)

        slug = resolve_slug(manifest, toolkit_dir)
        output = destination / f"{slug}_toolkit.zip"

        command = [
            sys.executable,
            str(PACKAGE_SCRIPT),
            str(toolkit_dir),
            "--output",
            str(output),
        ]
        if overwrite:
            command.insert(-2, "--force")

        subprocess.run(command, check=True)
        print(f"Packaged {slug} toolkit from {toolkit_dir}")


def ensure_frontend_bundle(toolkit_dir: pathlib.Path, manifest: dict) -> None:
    frontend = manifest.get("frontend")
    if not frontend:
        return

    frontend = frontend or {}
    entry_rel = frontend.get("entry") or "frontend/dist/index.js"
    entry_path = toolkit_dir / entry_rel
    source_rel = frontend.get("source_entry")
    if not source_rel:
        if not entry_path.exists():
            raise RuntimeError(
                f"frontend entry '{entry_rel}' declared in toolkit.json is missing "
                f"and no source_entry was provided for {toolkit_dir}"
            )
        return

    source_path = toolkit_dir / source_rel
    if not source_path.exists():
        raise RuntimeError(
            f"frontend.source_entry '{source_rel}' declared in toolkit.json is missing for {toolkit_dir}"
        )

    entry_path.parent.mkdir(parents=True, exist_ok=True)

    relative_source = os.path.relpath(source_path, FRONTEND_ROOT)
    relative_output = os.path.relpath(entry_path, FRONTEND_ROOT)

    command = [
        "npx",
        "--yes",
        "esbuild",
        relative_source,
        "--bundle",
        "--format=esm",
        "--platform=browser",
        f"--outfile={relative_output}",
        "--external:react",
        "--external:react-dom",
        "--external:react-router-dom",
        "--loader:.ts=ts",
        "--loader:.tsx=tsx",
    ]

    print(f"-- bundling toolkit frontend via esbuild: {' '.join(command)}")
    subprocess.run(command, check=True, cwd=FRONTEND_ROOT)

    if not entry_path.exists():
        raise RuntimeError(f"esbuild did not produce expected bundle at {entry_path}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package all toolkits into zip archives.")
    parser.add_argument(
        "--destination",
        type=pathlib.Path,
        default=pathlib.Path("/tmp/toolkits"),
        help="Directory to write toolkit archives into.",
    )
    parser.add_argument(
        "--toolkits-dir",
        type=pathlib.Path,
        default=DEFAULT_TOOLKIT_DIR,
        help="Root directory to scan for toolkit manifests.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing archives when present.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    package_all(args.toolkits_dir.resolve(), args.destination.resolve(), args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
