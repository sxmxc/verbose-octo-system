import io
import zipfile
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, UploadFile

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
