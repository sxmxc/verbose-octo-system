import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from pydantic import AnyHttpUrl

from app.routes import toolkits, toolbox_settings


class DummyAsyncClient:
    def __init__(self, responses):
        self._responses = responses
        self._calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, **kwargs):
        self._calls.append(url)
        response_factory = self._responses.pop(0)
        return response_factory(url)


def make_session_stub():
    return SimpleNamespace(
        add=MagicMock(),
        flush=AsyncMock(),
        commit=AsyncMock(),
        delete=AsyncMock(),
        get=AsyncMock(return_value=None),
    )


class UserServiceStub:
    def __init__(self, session):
        self.session = session
        self.audit_calls = []

    async def audit(self, **kwargs):
        self.audit_calls.append(kwargs)


@pytest.mark.anyio("asyncio")
async def test_toolkits_community_catalog_returns_entries(monkeypatch):
    session = make_session_stub()

    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/catalog.json"), None)),
    )

    def response_factory(url):
        return httpx.Response(
            status_code=200,
            request=httpx.Request("GET", url),
            json={
                "toolkits": [
                    {
                        "slug": "demo",
                        "name": "Demo Toolkit",
                        "description": "Example entry",
                        "bundle_url": "toolkits/demo.zip",
                        "tags": ["sample"],
                    }
                ]
            },
        )

    dummy_client = DummyAsyncClient([response_factory])
    monkeypatch.setattr(toolkits.httpx, "AsyncClient", lambda *a, **kw: dummy_client)

    result = await toolkits.toolkits_community_catalog(session=session)

    assert result.catalog_url is not None
    assert result.configured_url is None
    assert len(result.toolkits) == 1
    assert result.toolkits[0].slug == "demo"
    assert str(result.toolkits[0].resolved_bundle_url) == "https://catalog.example/toolkits/demo.zip"


@pytest.mark.anyio("asyncio")
async def test_toolkits_install_from_catalog_downloads_bundle(tmp_path, monkeypatch):
    session = make_session_stub()
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", tmp_path)

    entry = toolkits.CommunityToolkitEntry(
        slug="demo",
        name="Demo Toolkit",
        bundle_url="toolkits/demo/bundle.zip",
        resolved_bundle_url="https://example.com/demo.zip",
    )
    monkeypatch.setattr(
        toolkits,
        "_fetch_community_catalog",
        AsyncMock(return_value=[entry]),
    )
    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/catalog.json"), None)),
    )

    bundle = io.BytesIO()
    with toolkits.zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{\"slug\": \"demo\"}")
    bundle.seek(0)

    def download_response(url):
        return httpx.Response(
            status_code=200,
            request=httpx.Request("GET", url),
            content=bundle.getvalue(),
        )

    dummy_client = DummyAsyncClient([download_response])
    monkeypatch.setattr(toolkits.httpx, "AsyncClient", lambda *a, **kw: dummy_client)

    record = SimpleNamespace(slug="demo", name="Demo Toolkit", origin="community", enabled=False)
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", MagicMock(return_value=record))
    monkeypatch.setattr(toolkits, "UserService", lambda session: UserServiceStub(session))

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})

    result = await toolkits.toolkits_install_from_catalog(
        payload=toolkits.CommunityInstallRequest(slug="demo"),
        request=request,
        session=session,
        current_user=SimpleNamespace(),
    )

    assert result.slug == "demo"
    assert (tmp_path / "demo.zip").exists()


@pytest.mark.anyio("asyncio")
async def test_toolkits_install_from_catalog_uses_catalog_base_for_relative_bundle(tmp_path, monkeypatch):
    session = make_session_stub()
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", tmp_path)

    entry = toolkits.CommunityToolkitEntry(
        slug="demo",
        name="Demo Toolkit",
        bundle_url="toolkits/demo/bundle",
    )
    monkeypatch.setattr(
        toolkits,
        "_fetch_community_catalog",
        AsyncMock(return_value=[entry]),
    )
    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(
            return_value=(
                AnyHttpUrl("https://sxmxc.github.io/ideal-octo-engine/catalog/toolkits.json"),
                None,
            ),
        ),
    )

    bundle = io.BytesIO()
    with toolkits.zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{\"slug\": \"demo\"}")
    bundle.seek(0)

    def success_response(url):
        return httpx.Response(
            status_code=200,
            request=httpx.Request("GET", url),
            content=bundle.getvalue(),
        )

    dummy_client = DummyAsyncClient([success_response])
    monkeypatch.setattr(toolkits.httpx, "AsyncClient", lambda *a, **kw: dummy_client)

    record = SimpleNamespace(slug="demo", name="Demo Toolkit", origin="community", enabled=False)
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", MagicMock(return_value=record))
    monkeypatch.setattr(toolkits, "UserService", lambda session: UserServiceStub(session))

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})

    result = await toolkits.toolkits_install_from_catalog(
        payload=toolkits.CommunityInstallRequest(slug="demo"),
        request=request,
        session=session,
        current_user=SimpleNamespace(),
    )

    assert result.slug == "demo"
    assert dummy_client._calls == [
        "https://sxmxc.github.io/ideal-octo-engine/toolkits/demo/bundle",
    ]


@pytest.mark.anyio("asyncio")
async def test_toolkits_install_from_catalog_falls_back_to_manifest_when_catalog_base_fails(tmp_path, monkeypatch):
    session = make_session_stub()
    monkeypatch.setattr(toolkits.settings, "toolkit_storage_dir", tmp_path)

    entry = toolkits.CommunityToolkitEntry(
        slug="demo",
        name="Demo Toolkit",
        bundle_url="toolkits/demo/bundle",
    )
    monkeypatch.setattr(
        toolkits,
        "_fetch_community_catalog",
        AsyncMock(return_value=[entry]),
    )
    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(
            return_value=(
                AnyHttpUrl("https://sxmxc.github.io/ideal-octo-engine/catalog/toolkits.json"),
                None,
            ),
        ),
    )

    bundle = io.BytesIO()
    with toolkits.zipfile.ZipFile(bundle, "w") as zf:
        zf.writestr("toolkit.json", "{\"slug\": \"demo\"}")
    bundle.seek(0)

    def primary_response(url):
        return httpx.Response(
            status_code=404,
            request=httpx.Request("GET", url),
        )

    def fallback_response(url):
        return httpx.Response(
            status_code=200,
            request=httpx.Request("GET", url),
            content=bundle.getvalue(),
        )

    dummy_client = DummyAsyncClient([primary_response, fallback_response])
    monkeypatch.setattr(toolkits.httpx, "AsyncClient", lambda *a, **kw: dummy_client)

    record = SimpleNamespace(slug="demo", name="Demo Toolkit", origin="community", enabled=False)
    monkeypatch.setattr(toolkits, "install_toolkit_from_directory", MagicMock(return_value=record))
    monkeypatch.setattr(toolkits, "UserService", lambda session: UserServiceStub(session))

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})

    result = await toolkits.toolkits_install_from_catalog(
        payload=toolkits.CommunityInstallRequest(slug="demo"),
        request=request,
        session=session,
        current_user=SimpleNamespace(),
    )

    assert result.slug == "demo"
    assert dummy_client._calls == [
        "https://sxmxc.github.io/ideal-octo-engine/toolkits/demo/bundle",
        "https://sxmxc.github.io/ideal-octo-engine/catalog/toolkits/demo/bundle",
    ]


@pytest.mark.anyio("asyncio")
async def test_toolkits_install_from_catalog_rejects_missing_bundle(monkeypatch):
    session = make_session_stub()
    entry = toolkits.CommunityToolkitEntry(
        slug="stub",
        name="Stub Toolkit",
        bundle_url=None,
    )
    monkeypatch.setattr(
        toolkits,
        "_fetch_community_catalog",
        AsyncMock(return_value=[entry]),
    )
    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/catalog.json"), None)),
    )

    monkeypatch.setattr(toolkits, "httpx", SimpleNamespace(AsyncClient=lambda *a, **kw: None))

    request = SimpleNamespace(client=None, headers={})

    with pytest.raises(toolkits.HTTPException) as exc_info:
        await toolkits.toolkits_install_from_catalog(
            payload=toolkits.CommunityInstallRequest(slug="stub"),
            request=request,
            session=session,
            current_user=SimpleNamespace(),
        )

    assert exc_info.value.status_code == 400
    assert "not yet available" in exc_info.value.detail


@pytest.mark.anyio("asyncio")
async def test_toolbox_settings_get_catalog(monkeypatch):
    session = make_session_stub()
    monkeypatch.setattr(
        toolbox_settings,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/catalog.json"), None)),
    )

    result = await toolbox_settings.get_catalog_settings(session=session, _=object())

    assert str(result.effective_url) == "https://catalog.example/catalog.json"
    assert result.configured_url is None


@pytest.mark.anyio("asyncio")
async def test_toolbox_settings_update_catalog(monkeypatch):
    class SystemSettingServiceStub:
        def __init__(self, session):
            self.session = session
            self.saved = None
            self.deleted = False
            session.toolbox_service_stub = self

        async def set_json(self, key, value):
            self.saved = (key, value)

        async def delete(self, key):
            self.deleted = True

    session = make_session_stub()
    session.commit = AsyncMock()

    monkeypatch.setattr(toolbox_settings, "SystemSettingService", SystemSettingServiceStub)
    monkeypatch.setattr(
        toolbox_settings,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/catalog.json"), AnyHttpUrl("https://catalog.example/catalog.json"))),
    )

    result = await toolbox_settings.update_catalog_settings(
        payload=toolbox_settings.CatalogSettingsRequest(url="https://catalog.example/catalog.json"),
        session=session,
        _=object(),
    )

    assert str(result.effective_url) == "https://catalog.example/catalog.json"
    assert str(result.configured_url) == "https://catalog.example/catalog.json"
    assert session.toolbox_service_stub.saved == (toolkits.CATALOG_URL_SETTING_KEY, "https://catalog.example/catalog.json")
