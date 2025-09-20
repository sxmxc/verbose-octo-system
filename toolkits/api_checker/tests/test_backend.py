from __future__ import annotations

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any, Dict

from itertools import chain, repeat

import sys

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "toolkits" / "api_checker" / "backend" / "app.py"
spec = spec_from_file_location("toolkits.api_checker.backend.app", MODULE_PATH)
assert spec is not None and spec.loader is not None
app_module = module_from_spec(spec)
sys.modules[spec.name] = app_module
spec.loader.exec_module(app_module)

router = app_module.router


class DummyAsyncClient:
    def __init__(self, response_payload: Dict[str, Any]) -> None:
        self._response_payload = response_payload
        self.last_request: Dict[str, Any] | None = None

    async def __aenter__(self) -> "DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - no cleanup needed
        return None

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        self.last_request = {"method": method, "url": url, **kwargs}
        request = httpx.Request(method, url, headers=kwargs.get("headers"), params=kwargs.get("params"))
        response_kwargs: Dict[str, Any] = {
            "status_code": self._response_payload.get("status_code", 200),
            "headers": self._response_payload.get("headers", {}),
            "request": request,
        }
        if "json" in self._response_payload:
            response_kwargs["json"] = self._response_payload["json"]
        else:
            response_kwargs["content"] = self._response_payload.get("content", b"")
        return httpx.Response(**response_kwargs)


def test_execute_request_success(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router, prefix="/toolkits/api-checker")

    perf_values = chain([1.0, 1.25], repeat(1.25))
    monkeypatch.setattr(app_module.time, "perf_counter", lambda: next(perf_values))

    dummy_client = DummyAsyncClient(
        {
            "status_code": 201,
            "json": {"message": "created"},
            "headers": {"content-type": "application/json", "x-request-id": "req-123"},
        }
    )
    monkeypatch.setattr(app_module, "create_async_client", lambda payload: dummy_client)

    client = TestClient(app)

    payload = {
        "method": "GET",
        "url": "https://example.com/api",
        "query_params": [{"name": "q", "value": "one", "enabled": True}],
        "headers": [{"name": "Accept", "value": "application/json", "enabled": True}],
        "body": {"mode": "none", "content": None, "content_type": None},
        "auth": {"type": "none", "username": None, "password": None, "token": None, "header_name": None, "header_value": None},
        "follow_redirects": True,
        "timeout": 15,
    }

    response = client.post("/toolkits/api-checker/requests", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["status_code"] == 201
    assert data["reason_phrase"] == "Created"
    assert data["json_body"] == {"message": "created"}
    assert data["duration_ms"] >= 0
    assert data["method"] == "GET"
    assert any(header["name"].lower() == "content-type" for header in data["headers"])

    assert dummy_client.last_request is not None
    assert dummy_client.last_request["method"] == "GET"
    assert dummy_client.last_request["url"] == "https://example.com/api"
    assert dummy_client.last_request["params"] == [("q", "one")]
    assert ("Accept", "application/json") in dummy_client.last_request["headers"]


def test_execute_request_invalid_json_body(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router, prefix="/toolkits/api-checker")

    dummy_client = DummyAsyncClient({"status_code": 200, "json": {"ok": True}})
    monkeypatch.setattr(app_module, "create_async_client", lambda payload: dummy_client)

    client = TestClient(app)

    payload = {
        "method": "POST",
        "url": "https://api.example.com/items",
        "query_params": [],
        "headers": [],
        "body": {"mode": "json", "content": "{\"missing\"", "content_type": None},
        "auth": {"type": "none", "username": None, "password": None, "token": None, "header_name": None, "header_value": None},
        "follow_redirects": True,
        "timeout": 10,
    }

    response = client.post("/toolkits/api-checker/requests", json=payload)
    assert response.status_code == 400
    assert "Invalid JSON body" in response.json()["detail"]
    # The HTTP call should not be attempted when validation fails.
    assert dummy_client.last_request is None


def test_execute_request_applies_bearer_token(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router, prefix="/toolkits/api-checker")

    perf_values = chain([10.0, 10.1], repeat(10.1))
    monkeypatch.setattr(app_module.time, "perf_counter", lambda: next(perf_values))

    dummy_client = DummyAsyncClient(
        {
            "status_code": 200,
            "content": b"OK",
            "headers": {"content-type": "text/plain"},
        }
    )
    monkeypatch.setattr(app_module, "create_async_client", lambda payload: dummy_client)

    client = TestClient(app)

    payload = {
        "method": "POST",
        "url": "https://secure.example.com/echo",
        "query_params": [],
        "headers": [],
        "body": {"mode": "raw", "content": "hello", "content_type": "text/plain"},
        "auth": {
            "type": "bearer",
            "username": None,
            "password": None,
            "token": "abc123",
            "header_name": None,
            "header_value": None,
        },
        "follow_redirects": False,
        "timeout": 5,
    }

    response = client.post("/toolkits/api-checker/requests", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["body"].strip() == "OK"
    assert data["is_binary"] is False
    request_headers = {header["name"].lower(): header["value"] for header in data["request_headers"]}
    assert request_headers.get("authorization") == "Bearer abc123"

    assert dummy_client.last_request is not None
    assert ("Authorization", "Bearer abc123") in dummy_client.last_request["headers"]
    assert dummy_client.last_request.get("auth") is None
