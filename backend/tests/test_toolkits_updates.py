from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import AnyHttpUrl

from app.routes import toolkits
from app.toolkits.registry import ToolkitRecord


def make_session_stub():
    return SimpleNamespace(
        add=AsyncMock(),
        flush=AsyncMock(),
        commit=AsyncMock(),
        delete=AsyncMock(),
        get=AsyncMock(return_value=None),
    )


@pytest.mark.anyio("asyncio")
async def test_toolkits_updates_reports_catalog_version(monkeypatch):
    record = ToolkitRecord(
        slug="demo",
        name="Demo",
        description="",
        base_path="/toolkits/demo",
        enabled=True,
        category="toolkit",
        tags=[],
        origin="community",
        version="1.0.0",
        backend_module=None,
        backend_router_attr=None,
        worker_module=None,
        worker_register_attr=None,
        dashboard_cards=[],
        dashboard_context_module=None,
        dashboard_context_attr=None,
        frontend_entry=None,
        frontend_source_entry=None,
    )

    monkeypatch.setattr(toolkits, "list_toolkits", lambda: [record])
    monkeypatch.setattr(
        toolkits,
        "_resolve_catalog_url",
        AsyncMock(return_value=(AnyHttpUrl("https://catalog.example/toolkits.json"), None)),
    )
    monkeypatch.setattr(
        toolkits,
        "_fetch_community_catalog",
        AsyncMock(
            return_value=[
                toolkits.CommunityToolkitEntry(
                    slug="demo",
                    name="Demo",
                    version="1.1.0",
                    bundle_url="demo.zip",
                )
            ]
        ),
    )

    session = make_session_stub()
    result = await toolkits.toolkits_updates(session=session)

    assert len(result) == 1
    status = result[0]
    assert status.slug == "demo"
    assert status.update_available is True
    assert status.available_version == "1.1.0"
    assert status.source == "https://catalog.example/toolkits.json"


@pytest.mark.anyio("asyncio")
async def test_toolkits_update_bundle_invokes_catalog_install(monkeypatch):
    record = ToolkitRecord(
        slug="demo",
        name="Demo",
        description="",
        base_path="/toolkits/demo",
        enabled=True,
        category="toolkit",
        tags=[],
        origin="community",
        version="1.0.0",
        backend_module=None,
        backend_router_attr=None,
        worker_module=None,
        worker_register_attr=None,
        dashboard_cards=[],
        dashboard_context_module=None,
        dashboard_context_attr=None,
        frontend_entry=None,
        frontend_source_entry=None,
    )

    updated = record.model_copy(update={"version": "1.1.0"})

    monkeypatch.setattr(toolkits, "get_toolkit", lambda slug: record)
    monkeypatch.setattr(toolkits, "_get_toolkit_or_404", lambda slug: record)
    install_mock = AsyncMock(return_value=updated)
    monkeypatch.setattr(toolkits, "toolkits_install_from_catalog", install_mock)

    session = make_session_stub()
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})

    result = await toolkits.toolkits_update_bundle(
        slug="demo",
        request=request,
        session=session,
        current_user=SimpleNamespace(),
    )

    install_mock.assert_awaited_once()
    assert result.version == "1.1.0"


@pytest.mark.anyio("asyncio")
async def test_toolkits_update_bundle_rejects_non_community(monkeypatch):
    record = ToolkitRecord(
        slug="demo",
        name="Demo",
        description="",
        base_path="/toolkits/demo",
        enabled=True,
        category="toolkit",
        tags=[],
        origin="uploaded",
        version="1.0.0",
        backend_module=None,
        backend_router_attr=None,
        worker_module=None,
        worker_register_attr=None,
        dashboard_cards=[],
        dashboard_context_module=None,
        dashboard_context_attr=None,
        frontend_entry=None,
        frontend_source_entry=None,
    )

    monkeypatch.setattr(toolkits, "_get_toolkit_or_404", lambda slug: record)

    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})

    with pytest.raises(toolkits.HTTPException) as exc_info:
        await toolkits.toolkits_update_bundle(
            slug="demo",
            request=request,
            session=make_session_stub(),
            current_user=SimpleNamespace(),
        )

    assert exc_info.value.status_code == toolkits.status.HTTP_400_BAD_REQUEST
    assert "only supported" in exc_info.value.detail
