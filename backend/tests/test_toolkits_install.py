import io
import zipfile
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, UploadFile, status

from app.routes import toolkits


@pytest.mark.asyncio
async def test_toolkits_install_rejects_path_traversal(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)

    install_mock = MagicMock(side_effect=AssertionError("install_toolkit_from_directory should not run"))
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", install_mock)

    malicious_zip = io.BytesIO()
    with zipfile.ZipFile(malicious_zip, "w") as zf:
        zf.writestr("../../outside.txt", "pwned")
    malicious_zip.seek(0)

    upload = UploadFile(filename="malicious.zip", file=io.BytesIO(malicious_zip.getvalue()))

    with pytest.raises(HTTPException) as exc_info:
        await toolkits.toolkits_install(slug="evil", file=upload)

    assert exc_info.value.status_code == 400
    install_mock.assert_not_called()

    outside_path = storage_dir / "outside.txt"
    assert not outside_path.exists()

    bundle_path = storage_dir / "malicious.zip"
    assert not bundle_path.exists()

    toolkit_root = storage_dir / "__uploads__" / "evil"
    assert not toolkit_root.exists()


@pytest.mark.asyncio
async def test_toolkits_install_strips_directory_segments(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)

    record = MagicMock()
    record.slug = "clean"
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", MagicMock(return_value=record))

    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{}")
    bundle.seek(0)

    original_stream = toolkits._stream_upload_to_path
    captured = {}

    async def capture_stream(source, destination):
        captured["destination"] = destination
        return await original_stream(source, destination)

    monkeypatch.setattr(toolkits, "_stream_upload_to_path", capture_stream)

    upload = UploadFile(filename="../../nested\\evil.zip", file=io.BytesIO(bundle.getvalue()))

    result = await toolkits.toolkits_install(slug="clean", file=upload)

    assert captured["destination"].name == "evil.zip"
    assert captured["destination"].parent == storage_dir
    assert result["bundle_path"] == str((storage_dir / "clean.zip").resolve())


@pytest.mark.asyncio
async def test_toolkits_install_randomises_collisions(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)

    existing = storage_dir / "duplicate.zip"
    existing.write_bytes(b"existing")

    record = MagicMock()
    record.slug = "frombundle"
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", MagicMock(return_value=record))

    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{}")
    bundle.seek(0)

    original_stream = toolkits._stream_upload_to_path
    captured = {}

    async def capture_stream(source, destination):
        captured["destination"] = destination
        return await original_stream(source, destination)

    monkeypatch.setattr(toolkits, "_stream_upload_to_path", capture_stream)
    monkeypatch.setattr(toolkits, "_random_collision_suffix", lambda: "deadbeef")

    upload = UploadFile(filename="duplicate.zip", file=io.BytesIO(bundle.getvalue()))

    result = await toolkits.toolkits_install(slug=None, file=upload)

    assert captured["destination"].name == "duplicate-deadbeef.zip"
    assert captured["destination"].parent == storage_dir
    assert existing.exists()
    assert result["bundle_path"] == str((storage_dir / "frombundle.zip").resolve())


@pytest.mark.asyncio
async def test_toolkits_install_rejects_invalid_slug(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)

    install_mock = MagicMock(side_effect=AssertionError("install_toolkit_from_directory should not run"))
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", install_mock)

    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{}")
    bundle.seek(0)

    upload = UploadFile(filename="valid.zip", file=io.BytesIO(bundle.getvalue()))

    with pytest.raises(HTTPException) as exc_info:
        await toolkits.toolkits_install(slug="NOT OK", file=upload)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Toolkit slug must" in exc_info.value.detail
    install_mock.assert_not_called()


@pytest.mark.asyncio
async def test_toolkits_install_rejects_upload_exceeding_max_bytes(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)
    monkeypatch.setattr(toolkits.settings, "toolkit_upload_max_bytes", 64)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_bytes", 1024)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_file_bytes", 1024)

    install_mock = MagicMock(side_effect=AssertionError("install_toolkit_from_directory should not run"))
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", install_mock)

    payload = b"x" * 128
    upload = UploadFile(filename="too-big.zip", file=io.BytesIO(payload))

    with pytest.raises(HTTPException) as exc_info:
        await toolkits.toolkits_install(slug="huge", file=upload)

    assert exc_info.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    install_mock.assert_not_called()
    assert not (storage_dir / "too-big.zip").exists()
    assert not (storage_dir / "__uploads__" / "huge").exists()


@pytest.mark.asyncio
async def test_toolkits_install_rejects_entry_over_file_limit(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)
    monkeypatch.setattr(toolkits.settings, "toolkit_upload_max_bytes", 1024)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_bytes", 1024)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_file_bytes", 5)

    install_mock = MagicMock(side_effect=AssertionError("install_toolkit_from_directory should not run"))
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", install_mock)

    oversized_zip = io.BytesIO()
    with zipfile.ZipFile(oversized_zip, "w") as zf:
        zf.writestr("big.txt", "0123456789")
    oversized_zip.seek(0)

    upload = UploadFile(filename="oversized.zip", file=io.BytesIO(oversized_zip.getvalue()))

    with pytest.raises(HTTPException) as exc_info:
        await toolkits.toolkits_install(slug="limit", file=upload)

    assert exc_info.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    install_mock.assert_not_called()

    bundle_path = storage_dir / "oversized.zip"
    assert not bundle_path.exists()

    toolkit_root = storage_dir / "__uploads__" / "limit"
    assert not toolkit_root.exists()


@pytest.mark.asyncio
async def test_toolkits_install_rejects_total_uncompressed_limit(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", storage_dir)
    monkeypatch.setattr(toolkits.settings, "toolkit_upload_max_bytes", 2048)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_bytes", 15)
    monkeypatch.setattr(toolkits.settings, "toolkit_bundle_max_file_bytes", 20)

    install_mock = MagicMock(side_effect=AssertionError("install_toolkit_from_directory should not run"))
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", install_mock)

    bomb_zip = io.BytesIO()
    with zipfile.ZipFile(bomb_zip, "w") as zf:
        zf.writestr("a.txt", "abcdefghij")
        zf.writestr("b.txt", "abcdefghij")
    bomb_zip.seek(0)

    upload = UploadFile(filename="expands.zip", file=io.BytesIO(bomb_zip.getvalue()))

    with pytest.raises(HTTPException) as exc_info:
        await toolkits.toolkits_install(slug="expands", file=upload)

    assert exc_info.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    install_mock.assert_not_called()

    bundle_path = storage_dir / "expands.zip"
    assert not bundle_path.exists()

    toolkit_root = storage_dir / "__uploads__" / "expands"
    assert not toolkit_root.exists()
