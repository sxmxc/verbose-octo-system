from __future__ import annotations

import errno
import json
import ntpath
import secrets
import shutil
import stat
import tempfile
import zipfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlparse, urlunparse

import httpx
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile, Request, status
from pydantic import AliasChoices, AnyHttpUrl, BaseModel, Field, TypeAdapter, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

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
from ..toolkits.slugs import InvalidToolkitSlugError, normalise_slug, validate_slug
from ..toolkits.seeder import ensure_bundled_toolkits_installed
from ..toolkit_loader import activate_toolkit, mark_toolkit_removed
from ..security.dependencies import require_roles, require_superuser
from ..security.roles import ROLE_TOOLKIT_CURATOR, ROLE_TOOLKIT_USER
from ..db.session import get_session
from ..services.users import UserService
from ..services.system_settings import SystemSettingService


UPLOAD_WRITE_CHUNK_SIZE = 1024 * 1024
CATALOG_URL_SETTING_KEY = "toolkit.catalog.url"


def _catalog_site_root_url(catalog_url: AnyHttpUrl) -> str:
    parsed = urlparse(str(catalog_url))
    host = parsed.netloc.lower()
    segments = [segment for segment in parsed.path.split("/") if segment]

    if host in {"raw.githubusercontent.com", "raw.github.com"} and len(segments) >= 2:
        owner, repo = segments[:2]
        return f"https://{owner}.github.io/{repo}/"

    if host.endswith(".github.io") and segments:
        root_path = f"/{segments[0]}/"
        return urlunparse(parsed._replace(path=root_path, params="", query="", fragment=""))

    return urlunparse(parsed._replace(path="/", params="", query="", fragment=""))


def _build_bundle_url_candidates(
    catalog_url: AnyHttpUrl,
    entry: CommunityToolkitEntry,
) -> list[str]:
    raw_candidates: list[str] = []

    if entry.resolved_bundle_url:
        raw_candidates.append(str(entry.resolved_bundle_url))

    bundle_url = (entry.bundle_url or "").strip()
    if bundle_url:
        variants = [bundle_url]
        trimmed = bundle_url.rstrip("/")
        if trimmed and not PurePosixPath(trimmed).suffix:
            variants.append(f"{trimmed}.zip")

        deferred_raw: list[str] = []
        trailing_raw: list[str] = []

        for variant in variants:
            if variant.startswith(("http://", "https://")):
                raw_candidates.append(variant)
                continue

            if entry.homepage:
                raw_candidates.append(urljoin(str(entry.homepage), variant))

            root_base = _catalog_site_root_url(catalog_url)
            raw_candidates.append(urljoin(root_base, variant))

            raw_variant = urljoin(str(catalog_url), variant)
            if variant == bundle_url and len(variants) > 1:
                deferred_raw.append(raw_variant)
            elif variant != bundle_url and variant.endswith(".zip"):
                trailing_raw.append(raw_variant)
            else:
                raw_candidates.append(raw_variant)

        raw_candidates.extend(deferred_raw)
        raw_candidates.extend(trailing_raw)

    candidates: list[str] = []
    for candidate in raw_candidates:
        if not candidate:
            continue
        try:
            validated = ANY_HTTP_URL_ADAPTER.validate_python(candidate)
        except ValidationError:
            continue
        candidate_str = str(validated)
        if candidate_str not in candidates:
            candidates.append(candidate_str)
    return candidates


ANY_HTTP_URL_ADAPTER = TypeAdapter(AnyHttpUrl)


class CommunityToolkitEntry(BaseModel):
    slug: str
    name: str
    description: str | None = None
    version: str | None = None
    bundle_url: str | None = Field(default=None, validation_alias=AliasChoices("bundle_url", "bundle"))
    resolved_bundle_url: AnyHttpUrl | None = None
    homepage: AnyHttpUrl | None = None
    maintainer: str | None = None
    maintainers: list[str] | None = None
    categories: list[str] | None = None
    tags: list[str] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True,
    }


class CommunityCatalogResponse(BaseModel):
    catalog_url: AnyHttpUrl | None
    configured_url: AnyHttpUrl | None = None
    toolkits: list[CommunityToolkitEntry]


class CommunityInstallRequest(BaseModel):
    slug: str = Field(..., description="Slug of the community toolkit to install")


def _format_limit_mb(value: int) -> int:
    return max(1, (value + (1024 * 1024 - 1)) // (1024 * 1024))


def _normalise_bundle_filename(raw_filename: str | None) -> str:
    if not raw_filename:
        return "upload.zip"
    normalised = raw_filename.replace("\\", "/")
    name = PurePosixPath(normalised).name
    if name in {"", ".", ".."}:
        return "upload.zip"
    return name


def _random_collision_suffix() -> str:
    return secrets.token_hex(4)


def _allocate_bundle_destination(storage_dir: Path, raw_filename: str | None) -> tuple[str, Path]:
    filename = _normalise_bundle_filename(raw_filename)
    candidate_path = storage_dir / filename
    if not candidate_path.exists():
        return filename, candidate_path

    base = Path(filename)
    suffix = "".join(base.suffixes) or ".zip"
    stem = base.name[: -len(suffix)] if suffix and filename.endswith(suffix) else base.stem
    if not stem:
        stem = "bundle"

    while True:
        candidate_name = f"{stem}-{_random_collision_suffix()}{suffix}"
        candidate_path = storage_dir / candidate_name
        if not candidate_path.exists():
            return candidate_name, candidate_path


def _ensure_valid_slug(slug: str) -> None:
    try:
        validate_slug(slug)
    except InvalidToolkitSlugError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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


async def _resolve_catalog_url(session: AsyncSession | None = None) -> tuple[AnyHttpUrl | None, AnyHttpUrl | None]:
    override_url: AnyHttpUrl | None = None
    if session is not None:
        settings_service = SystemSettingService(session)
        override = await settings_service.get_json(CATALOG_URL_SETTING_KEY, default=None)
        if isinstance(override, dict):
            override = override.get("url")
        if override:
            try:
                override_url = AnyHttpUrl(override)
            except ValidationError as exc:  # pragma: no cover - defensive guard
                raise HTTPException(status_code=500, detail="Stored catalog URL is invalid") from exc
    effective = override_url or settings.toolkit_catalog_url
    return effective, override_url


async def _fetch_community_catalog(catalog_url: AnyHttpUrl) -> list[CommunityToolkitEntry]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(str(catalog_url), follow_redirects=True)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch catalog: {exc}") from exc

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Catalog request returned HTTP {response.status_code}",
        )

    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Catalog payload is not valid JSON") from exc

    if isinstance(payload, dict):
        raw_entries = payload.get("toolkits")
        if raw_entries is None:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Catalog missing 'toolkits' key")
    elif isinstance(payload, list):  # pragma: no cover - flexible compatibility path
        raw_entries = payload
    else:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Catalog payload format is unsupported")

    entries: list[CommunityToolkitEntry] = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Catalog entry must be an object")
        try:
            model = CommunityToolkitEntry.model_validate(entry)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Invalid catalog entry: {exc}") from exc
        if model.bundle_url:
            candidates = _build_bundle_url_candidates(catalog_url, model)
            if candidates:
                try:
                    model.resolved_bundle_url = ANY_HTTP_URL_ADAPTER.validate_python(candidates[0])
                except ValidationError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Invalid catalog entry: {exc}"
                    ) from exc
        entries.append(model)
    return entries


def _write_remote_bundle(content: bytes, slug: str) -> Path:
    storage_dir = Path(settings.toolkit_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    bundle_path = storage_dir / f"{slug}.zip"
    with tempfile.NamedTemporaryFile(delete=False, dir=storage_dir) as tmp_file:
        tmp_file.write(content)
        tmp_source = Path(tmp_file.name)
    if bundle_path.exists():
        bundle_path.unlink()
    try:
        tmp_source.replace(bundle_path)
    except OSError as exc:
        if exc.errno != errno.EXDEV:
            tmp_source.unlink(missing_ok=True)
            raise
        shutil.copy2(tmp_source, bundle_path)
        tmp_source.unlink(missing_ok=True)
    return bundle_path


def _looks_like_zip(content: bytes) -> bool:
    if len(content) < 4:
        return False
    signature = content[:4]
    return signature in {b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"}


def _extract_zip_bundle(bundle_path: Path, extraction_dirname: str) -> Path:
    storage_dir = Path(settings.toolkit_storage_dir)
    upload_root = storage_dir / "__uploads__"
    upload_root.mkdir(parents=True, exist_ok=True)
    toolkit_root = upload_root / extraction_dirname

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
        shutil.rmtree(toolkit_root, ignore_errors=True)
        raise
    except zipfile.BadZipFile as exc:
        shutil.rmtree(toolkit_root, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Invalid zip bundle: {exc}") from exc

    return toolkit_root


@asynccontextmanager
async def toolkits_lifespan(_: FastAPI) -> AsyncIterator[None]:  # pragma: no cover - simple bootstrap
    ensure_bundled_toolkits_installed()
    yield


router = APIRouter(lifespan=toolkits_lifespan)


@router.get(
    "/",
    response_model=list[ToolkitRecord],
    summary="List registered toolkits",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkits_list():
    return list_toolkits()


@router.get(
    "/community",
    response_model=CommunityCatalogResponse,
    summary="List community toolkits",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_CURATOR]))],
)
async def toolkits_community_catalog(
    session: AsyncSession = Depends(get_session),
) -> CommunityCatalogResponse:
    catalog_url, configured_url = await _resolve_catalog_url(session)
    if not catalog_url:
        return CommunityCatalogResponse(catalog_url=None, configured_url=configured_url, toolkits=[])
    entries = await _fetch_community_catalog(catalog_url)
    return CommunityCatalogResponse(catalog_url=catalog_url, configured_url=configured_url, toolkits=entries)


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
)
async def toolkits_update(
    slug: str,
    payload: ToolkitUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_roles([ROLE_TOOLKIT_CURATOR])),
):
    _ensure_valid_slug(slug)
    previous = _get_toolkit_or_404(slug)
    toolkit = update_toolkit(slug, payload)
    if not toolkit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found")
    if toolkit.enabled and not previous.enabled:
        activate_toolkit(slug)
    if toolkit.enabled != previous.enabled:
        user_service = UserService(session)
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        await user_service.audit(
            user=current_user,
            actor=current_user,
            event="toolkit.enable" if toolkit.enabled else "toolkit.disable",
            payload={
                "slug": toolkit.slug,
                "name": toolkit.name,
                "enabled": toolkit.enabled,
            },
            source_ip=client_ip,
            user_agent=user_agent,
            target_type="toolkit",
            target_id=toolkit.slug,
        )
        await session.commit()
    return toolkit


@router.post(
    "/community/install",
    response_model=ToolkitRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Install a toolkit from the community catalog",
)
async def toolkits_install_from_catalog(
    payload: CommunityInstallRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_superuser),
) -> ToolkitRecord:
    try:
        slug = normalise_slug(payload.slug)
    except InvalidToolkitSlugError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    catalog_url, _ = await _resolve_catalog_url(session)
    if not catalog_url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Community catalog is disabled")

    entries = await _fetch_community_catalog(catalog_url)
    entry = next((item for item in entries if item.slug == slug), None)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Toolkit not found in catalog")

    candidate_urls = _build_bundle_url_candidates(catalog_url, entry)
    if not candidate_urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Toolkit bundle is not yet available for download",
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            download_content: bytes | None = None
            last_error: str | None = None
            for candidate in candidate_urls:
                try:
                    response = await client.get(
                        candidate,
                        follow_redirects=True,
                        headers={"accept": "application/zip, application/octet-stream"},
                    )
                except httpx.HTTPError as exc:
                    last_error = f"Failed to download bundle from {candidate}: {exc}"
                    continue

                if response.status_code == status.HTTP_200_OK:
                    candidate_content = response.content
                    if not _looks_like_zip(candidate_content):
                        last_error = (
                            f"Bundle download from {candidate} did not return a zip file"
                        )
                        continue
                    download_content = candidate_content
                    break

                last_error = (
                    f"Bundle download from {candidate} returned HTTP {response.status_code}"
                )

            if download_content is None:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=last_error or "Failed to download toolkit bundle",
                )
            content = download_content
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to download bundle: {exc}") from exc
    if len(content) > settings.toolkit_bundle_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Toolkit bundle exceeds the {_format_limit_mb(settings.toolkit_bundle_max_bytes)}MB limit",
        )

    bundle_path = _write_remote_bundle(content, slug)
    extraction_dirname = slug
    try:
        toolkit_root = _extract_zip_bundle(bundle_path, extraction_dirname)
    except HTTPException:
        bundle_path.unlink(missing_ok=True)
        raise

    try:
        record = install_toolkit_from_directory(
            toolkit_root,
            slug_override=slug,
            origin="community",
            enable_by_default=False,
            preserve_enabled=True,
        )
    except ToolkitManifestError as exc:
        bundle_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        shutil.rmtree(toolkit_root, ignore_errors=True)

    user_service = UserService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await user_service.audit(
        user=current_user,
        actor=current_user,
        event="toolkit.install",
        payload={
            "slug": record.slug,
            "name": record.name,
            "origin": "community",
            "enabled": record.enabled,
            "bundle_filename": f"{record.slug}.zip",
        },
        source_ip=client_ip,
        user_agent=user_agent,
        target_type="toolkit",
        target_id=record.slug,
    )
    await session.commit()

    return record


@router.delete(
    "/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom toolkit",
)
async def toolkits_delete(
    slug: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(require_superuser),
):
    _ensure_valid_slug(slug)
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

    user_service = UserService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await user_service.audit(
        user=current_user,
        actor=current_user,
        event="toolkit.uninstall",
        payload={
            "slug": slug,
            "name": toolkit.name,
            "origin": toolkit.origin,
        },
        source_ip=client_ip,
        user_agent=user_agent,
        target_type="toolkit",
        target_id=slug,
    )
    await session.commit()


@router.get(
    "/{slug}",
    response_model=ToolkitRecord,
    summary="Retrieve a toolkit definition",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkits_get(slug: str):
    _ensure_valid_slug(slug)
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
)
async def toolkits_install(
    request: Request,
    slug: str | None = Form(None),
    file: UploadFile = File(...),
    current_user=Depends(require_superuser),
    session: AsyncSession = Depends(get_session),
):
    if slug:
        try:
            slug = normalise_slug(slug)
        except InvalidToolkitSlugError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip bundles are supported")

    storage_dir = Path(settings.toolkit_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    bundle_filename, bundle_path = _allocate_bundle_destination(storage_dir, file.filename)

    await _stream_upload_to_path(file, bundle_path)

    extraction_dirname = slug or Path(bundle_filename).stem or "bundle"
    try:
        toolkit_root = _extract_zip_bundle(bundle_path, extraction_dirname)
    except HTTPException:
        bundle_path.unlink(missing_ok=True)
        raise

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
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        shutil.rmtree(toolkit_root, ignore_errors=True)

    desired_bundle_path = storage_dir / f"{record.slug}.zip"
    if bundle_path != desired_bundle_path:
        if desired_bundle_path.exists():
            desired_bundle_path.unlink()
        bundle_path.rename(desired_bundle_path)
        bundle_path = desired_bundle_path

    user_service = UserService(session)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await user_service.audit(
        user=current_user,
        actor=current_user,
        event="toolkit.install",
        payload={
            "slug": record.slug,
            "name": record.name,
            "origin": record.origin,
            "enabled": record.enabled,
            "bundle_filename": bundle_path.name,
        },
        source_ip=client_ip,
        user_agent=user_agent,
        target_type="toolkit",
        target_id=record.slug,
    )
    await session.commit()

    return {
        "uploaded": True,
        "toolkit": record,
    }


@router.post(
    "/{slug}/jobs",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue a toolkit job",
    dependencies=[Depends(require_roles([ROLE_TOOLKIT_USER]))],
)
def toolkit_enqueue_job(slug: str, operation: str = Form(...), payload: str | None = Form(None)):
    _ensure_valid_slug(slug)
    from ..worker_client import enqueue_job

    try:
        parsed_payload = json.loads(payload) if payload else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc

    job = enqueue_job(slug, operation, parsed_payload)
    return {"job": job}
