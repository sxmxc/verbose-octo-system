from __future__ import annotations

import json
import time
from collections.abc import Iterable
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, Field, ValidationInfo, field_validator


router = APIRouter()

MAX_BODY_PREVIEW_BYTES = 64_000
TEXTUAL_CONTENT_TYPES = (
    "text/",
    "application/json",
    "application/xml",
    "application/xhtml+xml",
    "application/javascript",
    "application/x-www-form-urlencoded",
)

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
RequestBodyMode = Literal["none", "raw", "json"]
AuthType = Literal["none", "basic", "bearer", "apiKey"]


class KeyValuePair(BaseModel):
    name: str = Field("", description="Header or parameter name")
    value: str = Field("", description="Header or parameter value")
    enabled: bool = Field(default=True, description="Whether the pair should be sent")

    @field_validator("name")
    def strip_name(cls, value: str) -> str:
        return value.strip()


class RequestBody(BaseModel):
    mode: RequestBodyMode = Field(default="none", description="How to encode the request body")
    content: str | None = Field(default=None, description="Raw request body content")
    content_type: str | None = Field(default=None, description="Explicit Content-Type header")

    @field_validator("content", mode="before")
    def normalize_content(cls, value: str | None, info: ValidationInfo) -> str | None:
        if info.data.get("mode") == "none":
            return None
        return value

    @field_validator("content_type", mode="before")
    def normalize_content_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class AuthConfig(BaseModel):
    type: AuthType = Field(default="none")
    username: str | None = None
    password: str | None = None
    token: str | None = None
    header_name: str | None = None
    header_value: str | None = None


class ApiRequestPayload(BaseModel):
    method: HttpMethod
    url: AnyHttpUrl
    query_params: list[KeyValuePair] = Field(default_factory=list)
    headers: list[KeyValuePair] = Field(default_factory=list)
    body: RequestBody = Field(default_factory=RequestBody)
    auth: AuthConfig = Field(default_factory=AuthConfig)
    follow_redirects: bool = Field(default=True)
    timeout: float = Field(default=30.0, ge=1.0, le=120.0)

    @field_validator("method")
    def normalize_method(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}:
            raise ValueError("Unsupported HTTP method")
        return normalized


class ResponseHeader(BaseModel):
    name: str
    value: str


class ApiResponse(BaseModel):
    status_code: int
    reason_phrase: str | None
    http_version: str | None
    url: str
    method: str
    duration_ms: float
    size_bytes: int
    content_type: str | None
    body: str
    body_truncated: bool
    is_binary: bool
    json_body: Any | None
    headers: list[ResponseHeader]
    request_headers: list[ResponseHeader]


def create_async_client(payload: ApiRequestPayload) -> httpx.AsyncClient:
    timeout = httpx.Timeout(payload.timeout)
    return httpx.AsyncClient(timeout=timeout, follow_redirects=payload.follow_redirects)


def _enabled_pairs(pairs: Iterable[KeyValuePair]) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    for pair in pairs:
        if pair.enabled and pair.name:
            results.append((pair.name, pair.value))
    return results


def _upsert_header(entries: list[tuple[str, str]], name: str, value: str) -> list[tuple[str, str]]:
    lower = name.lower()
    filtered = [(header, header_value) for header, header_value in entries if header.lower() != lower]
    filtered.append((name, value))
    return filtered


def _should_treat_as_text(content_type: str | None) -> bool:
    if not content_type:
        return False
    lowered = content_type.lower()
    return any(lowered.startswith(prefix) for prefix in TEXTUAL_CONTENT_TYPES)


@router.post("/requests", response_model=ApiResponse)
async def execute_request(payload: ApiRequestPayload) -> ApiResponse:
    headers = _enabled_pairs(payload.headers)
    query_params = _enabled_pairs(payload.query_params)

    auth: httpx.Auth | None = None
    if payload.auth.type == "basic":
        if not payload.auth.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is required for basic authentication.",
            )
        auth = httpx.BasicAuth(payload.auth.username, payload.auth.password or "")
    elif payload.auth.type == "bearer":
        if not payload.auth.token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token is required for bearer authentication.",
            )
        headers = _upsert_header(headers, "Authorization", f"Bearer {payload.auth.token}")
    elif payload.auth.type == "apiKey":
        if not payload.auth.header_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Header name is required for API key authentication.",
            )
        headers = _upsert_header(headers, payload.auth.header_name, payload.auth.header_value or "")

    body_kwargs: dict[str, Any] = {}
    if payload.body.mode == "json":
        content_text = payload.body.content or ""
        if content_text.strip():
            try:
                body_kwargs["json"] = json.loads(content_text)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid JSON body: {exc.msg}",
                ) from exc
        else:
            body_kwargs["content"] = b""
        headers = _upsert_header(headers, "Content-Type", payload.body.content_type or "application/json")
    elif payload.body.mode == "raw":
        body_kwargs["content"] = (payload.body.content or "").encode("utf-8")
        if payload.body.content_type:
            headers = _upsert_header(headers, "Content-Type", payload.body.content_type)

    request_kwargs: dict[str, Any] = {
        "method": payload.method,
        "url": str(payload.url),
        "params": query_params,
        "headers": headers,
    }
    request_kwargs.update(body_kwargs)
    if auth is not None:
        request_kwargs["auth"] = auth

    try:
        async with create_async_client(payload) as client:
            start_time = time.perf_counter()
            response = await client.request(**request_kwargs)
            duration_ms = (time.perf_counter() - start_time) * 1000
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Request timed out after {payload.timeout:.1f} seconds.",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Request failed: {exc}",
        ) from exc

    response_content_type = response.headers.get("content-type")
    body_bytes = response.content
    size_bytes = len(body_bytes)
    body_truncated = size_bytes > MAX_BODY_PREVIEW_BYTES
    preview_bytes = body_bytes[:MAX_BODY_PREVIEW_BYTES]

    encoding = response.charset_encoding or "utf-8"
    body_text = preview_bytes.decode(encoding, errors="replace")

    is_binary = not _should_treat_as_text(response_content_type)
    if not is_binary and "\x00" in body_text:
        is_binary = True

    json_body: Any | None = None
    if response_content_type and "json" in response_content_type.lower():
        try:
            json_body = response.json()
        except json.JSONDecodeError:
            json_body = None

    response_headers = [ResponseHeader(name=key, value=value) for key, value in response.headers.items()]
    request_headers = [
        ResponseHeader(name=key, value=value)
        for key, value in response.request.headers.items()
    ]

    return ApiResponse(
        status_code=response.status_code,
        reason_phrase=response.reason_phrase,
        http_version=response.http_version,
        url=str(response.url),
        method=response.request.method,
        duration_ms=duration_ms,
        size_bytes=size_bytes,
        content_type=response_content_type,
        body=body_text,
        body_truncated=body_truncated,
        is_binary=is_binary,
        json_body=json_body,
        headers=response_headers,
        request_headers=request_headers,
    )
