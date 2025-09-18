from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status, File, Form

from ..config import settings
from ..toolkits.install_utils import ToolkitManifestError, install_toolkit_from_directory
from ..toolkits.registry import (
    ToolkitCreate,
    ToolkitRecord,
    ToolkitUpdate,
    create_toolkit,
    delete_toolkit,
    get_toolkit,
    list_toolkits,
    update_toolkit,
)
from ..toolkits.seeder import ensure_bundled_toolkits_installed
from ..toolkit_loader import activate_toolkit, mark_toolkit_removed


router = APIRouter()


@router.on_event("startup")
def bootstrap_defaults() -> None:  # pragma: no cover - simple bootstrap
    ensure_bundled_toolkits_installed()


@router.get("/", response_model=list[ToolkitRecord], summary="List registered toolkits")
def toolkits_list():
    return list_toolkits()


@router.post("/", response_model=ToolkitRecord, status_code=status.HTTP_201_CREATED, summary="Register a new toolkit")
def toolkits_create(payload: ToolkitCreate):
    try:
        return create_toolkit(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{slug}", response_model=ToolkitRecord, summary="Update a toolkit definition")
def toolkits_update(slug: str, payload: ToolkitUpdate):
    previous = get_toolkit(slug)
    toolkit = update_toolkit(slug, payload)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    if toolkit.enabled and (previous is None or not previous.enabled):
        activate_toolkit(slug)
    return toolkit


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a custom toolkit")
def toolkits_delete(slug: str):
    toolkit = get_toolkit(slug)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    try:
        deleted = delete_toolkit(slug)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")

    storage_dir = Path(settings.toolkit_storage_dir)
    toolkit_root = storage_dir / slug
    if toolkit_root.exists():
        shutil.rmtree(toolkit_root, ignore_errors=True)
    bundle_path = storage_dir / f"{slug}.zip"
    if bundle_path.exists():
        bundle_path.unlink()

    if toolkit.origin == "bundled":
        storage_dir.mkdir(parents=True, exist_ok=True)
        sentinel = storage_dir / f".bundled-removed-{slug}"
        sentinel.write_text("removed")

    mark_toolkit_removed(slug)


@router.get("/{slug}", response_model=ToolkitRecord, summary="Retrieve a toolkit definition")
def toolkits_get(slug: str):
    toolkit = get_toolkit(slug)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    return toolkit


@router.post(
    "/install",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload and register a toolkit bundle",
)
async def toolkits_install(slug: str | None = Form(None), file: UploadFile = File(...)):
    if slug and any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for ch in slug.lower()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug must contain only letters, numbers, hyphen, or underscore")
    if slug:
        slug = slug.lower()

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip bundles are supported")

    storage_dir = Path(settings.toolkit_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    bundle_filename = file.filename or "upload.zip"
    bundle_path = storage_dir / bundle_filename

    upload_root = storage_dir / "__uploads__"
    upload_root.mkdir(parents=True, exist_ok=True)
    extraction_dirname = slug or Path(bundle_filename).stem or "bundle"
    toolkit_root = upload_root / extraction_dirname

    contents = await file.read()
    bundle_path.write_bytes(contents)

    if toolkit_root.exists():
        shutil.rmtree(toolkit_root)
    toolkit_root.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(bundle_path) as zf:
            zf.extractall(toolkit_root)
    except zipfile.BadZipFile as exc:
        bundle_path.unlink(missing_ok=True)
        shutil.rmtree(toolkit_root, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Invalid zip bundle: {exc}") from exc

    try:
        record = install_toolkit_from_directory(
            toolkit_root,
            slug_override=slug,
            origin="uploaded",
            enable_by_default=False,
            preserve_enabled=True,
        )
    except ToolkitManifestError as exc:
        bundle_path.unlink(missing_ok=True)
        shutil.rmtree(toolkit_root, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    desired_bundle_path = storage_dir / f"{record.slug}.zip"
    if bundle_path != desired_bundle_path:
        if desired_bundle_path.exists():
            desired_bundle_path.unlink()
        bundle_path.rename(desired_bundle_path)
        bundle_path = desired_bundle_path

    if toolkit_root.exists():
        shutil.rmtree(toolkit_root, ignore_errors=True)

    return {
        "uploaded": True,
        "toolkit": record,
        "bundle_path": str(bundle_path.resolve()),
    }


@router.post(
    "/{slug}/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue a toolkit job",
)
def toolkit_enqueue_job(slug: str, operation: str = Form(...), payload: str | None = Form(None)):
    from ..worker_client import enqueue_job

    try:
        parsed_payload = json.loads(payload) if payload else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc

    job = enqueue_job(slug, operation, parsed_payload)
    return {"job": job}
