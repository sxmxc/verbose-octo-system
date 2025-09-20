from __future__ import annotations

import json
import ntpath
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

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
from ..security.dependencies import require_roles, require_superuser
from ..security.roles import ROLE_TOOLKIT_CURATOR, ROLE_TOOLKIT_USER


UPLOAD_WRITE_CHUNK_SIZE = 1024 * 1024


def _format_limit_mb(value: int) -> int:
    return max(1, (value + (1024 * 1024 - 1)) // (1024 * 1024))


router = APIRouter()


async def _stream_upload_to_path(source: UploadFile, destination: Path) -> int:
    """Write an upload to disk without loading it fully into memory."""
    total_written = 0
    max_bytes = settings.toolkit_upload_max_bytes
    try:
        await source.seek(0)
        with destination.open("wb") as buffer:
            while True:
                chunk = await source.read(UPLOAD_WRITE_CHUNK_SIZE)
                if not chunk:
                    break
                total_written += len(chunk)
                if total_written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Toolkit bundle exceeds the {_format_limit_mb(max_bytes)}MB upload limit",
                    )
                buffer.write(chunk)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await source.close()
    return total_written


def _get_toolkit_or_404(slug: str) -> ToolkitRecord:
    toolkit = get_toolkit(slug)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    return toolkit


@router.on_event("startup")
def bootstrap_defaults() -> None:  # pragma: no cover - simple bootstrap
    ensure_bundled_toolkits_installed()


@router.get(
    "/",
    response_model=list[ToolkitRecord],
    summary="List registered toolkits",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkits_list():
    return list_toolkits()


@router.post(
    "/",
    response_model=ToolkitRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new toolkit",
    dependencies=[Depends(require_superuser)],
)
def toolkits_create(payload: ToolkitCreate):
    try:
        return create_toolkit(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put(
    "/{slug}",
    response_model=ToolkitRecord,
    summary="Update a toolkit definition",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_CURATOR]))],
)
def toolkits_update(slug: str, payload: ToolkitUpdate):
    previous = _get_toolkit_or_404(slug)
    toolkit = update_toolkit(slug, payload)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    if toolkit.enabled and not previous.enabled:
        activate_toolkit(slug)
    return toolkit


@router.delete(
    "/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom toolkit",
    dependencies=[Depends(require_superuser)],
)
def toolkits_delete(slug: str):
    toolkit = _get_toolkit_or_404(slug)
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

    mark_toolkit_removed(slug)


@router.get(
    "/{slug}",
    response_model=ToolkitRecord,
    summary="Retrieve a toolkit definition",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkits_get(slug: str):
    return _get_toolkit_or_404(slug)


def _resolve_safe_member_path(
    member: zipfile.ZipInfo, destination_root: Path, destination_root_resolved: Path
) -> Path:
    """Validate the zip member path and return the resolved destination path."""
    # Normalise separators to POSIX style to simplify validation
    raw_name = member.filename
    normalized = raw_name.replace("\\", "/")

    # Remove trailing slash to treat directories uniformly after validation
    if normalized.endswith("/"):
        normalized = normalized.rstrip("/")

    # Reject drive letters and absolute paths before joining
    if ntpath.splitdrive(normalized)[0]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid zip entry path: {raw_name}")

    pure_path = PurePosixPath(normalized)
    if pure_path.is_absolute():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid zip entry path: {raw_name}")

    # Normalise away current-directory references and reject parent traversals
    parts = [part for part in pure_path.parts if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid zip entry path: {raw_name}")

    if not parts:
        # Empty names (e.g. zip comment or root directory entry) resolve to the root
        return destination_root_resolved

    candidate_path = destination_root.joinpath(*parts)
    candidate_resolved = candidate_path.resolve()
    if candidate_resolved != destination_root_resolved and destination_root_resolved not in candidate_resolved.parents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid zip entry path: {raw_name}")

    return candidate_resolved


@router.post(
    "/install",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload and register a toolkit bundle",
    dependencies=[Depends(require_superuser)],
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

    await _stream_upload_to_path(file, bundle_path)

    if toolkit_root.exists():
        shutil.rmtree(toolkit_root)
    toolkit_root.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(bundle_path) as zf:
            destination_root = toolkit_root
            root_resolved = destination_root.resolve()
            total_uncompressed = 0
            max_total_bytes = settings.toolkit_bundle_max_bytes
            max_file_bytes = settings.toolkit_bundle_max_file_bytes
            for member in zf.infolist():
                target_path = _resolve_safe_member_path(member, destination_root, root_resolved)
                # Ensure metadata (like standalone directory entries) don't attempt traversal
                if target_path == root_resolved:
                    continue

                mode = member.external_attr >> 16
                if stat.S_ISLNK(mode):
                    raise HTTPException(status_code=400, detail="Toolkit bundle may not contain symbolic links")

                if member.is_dir():
                    target_path.mkdir(parents=True, exist_ok=True)
                    continue

                if member.file_size > max_file_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Toolkit file '{member.filename}' exceeds the {_format_limit_mb(max_file_bytes)}MB limit",
                    )

                total_uncompressed += member.file_size
                if total_uncompressed > max_total_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Toolkit bundle expands beyond the {_format_limit_mb(max_total_bytes)}MB limit",
                    )

                target_path.parent.mkdir(parents=True, exist_ok=True)
                bytes_written = 0
                with zf.open(member) as source, target_path.open("wb") as destination:
                    while True:
                        chunk = source.read(UPLOAD_WRITE_CHUNK_SIZE)
                        if not chunk:
                            break
                        bytes_written += len(chunk)
                        if bytes_written > max_file_bytes:
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail=f"Toolkit file '{member.filename}' exceeds the {_format_limit_mb(max_file_bytes)}MB limit",
                            )
                        destination.write(chunk)

                if mode:
                    target_path.chmod(mode & 0o777)
    except HTTPException:
        bundle_path.unlink(missing_ok=True)
        shutil.rmtree(toolkit_root, ignore_errors=True)
        raise
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
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkit_enqueue_job(slug: str, operation: str = Form(...), payload: str | None = Form(None)):
    from ..worker_client import enqueue_job

    try:
        parsed_payload = json.loads(payload) if payload else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc

    job = enqueue_job(slug, operation, parsed_payload)
    return {"job": job}
