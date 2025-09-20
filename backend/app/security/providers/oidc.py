from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import OidcAuthProvider as OidcAuthConfig
from ..state import sign_state, verify_state
from .base import AuthProvider, AuthResult


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _generate_code_verifier() -> str:
    return _b64url(os.urandom(32))


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return _b64url(digest)


def _default_claims(config: OidcAuthConfig) -> Dict[str, str]:
    mapping = {"username": "preferred_username", "email": "email", "display_name": "name"}
    mapping.update(config.claim_mappings)
    return mapping


class OidcAuthProvider(AuthProvider):
    config_model = OidcAuthConfig

    def __init__(self, config: OidcAuthConfig) -> None:
        super().__init__(config)
        self.config = config
        self._metadata: Dict[str, Any] | None = None
        self._jwks_client: PyJWKClient | None = None
        self._logger = logging.getLogger(__name__)

    async def _metadata_client(self) -> Dict[str, Any]:
        if self._metadata:
            return self._metadata
        async with httpx.AsyncClient(timeout=10.0) as client:
            discovery_url = str(self.config.discovery_url)
            resp = await client.get(discovery_url)
            resp.raise_for_status()
            data = resp.json()
        self._metadata = data
        return data

    def _redirect_uri(self, request: Request) -> str:
        base = str(self.config.redirect_base_url) if self.config.redirect_base_url else str(request.base_url).rstrip("/")
        return f"{base}/auth/sso/{self.name}/callback"

    async def begin(self, request: Request) -> Dict[str, Any]:
        metadata = await self._metadata_client()
        authorization_endpoint = metadata.get("authorization_endpoint")
        if not authorization_endpoint:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OIDC provider misconfigured")
        code_verifier = _generate_code_verifier() if self.config.use_pkce else None
        nonce = _b64url(os.urandom(16))
        state_payload = {
            "provider": self.name,
            "nonce": nonce,
        }
        if code_verifier:
            state_payload["code_verifier"] = code_verifier
        next_url = request.query_params.get("next")
        if next_url:
            state_payload["next"] = next_url
        mode = request.query_params.get("mode")
        if mode:
            state_payload["mode"] = mode
        state = sign_state(state_payload)
        params = {
            "response_type": self.config.response_type,
            "client_id": self.config.client_id,
            "redirect_uri": self._redirect_uri(request),
            "scope": " ".join(self.config.scopes),
            "state": state,
            "nonce": nonce,
        }
        if self.config.prompt:
            params["prompt"] = self.config.prompt
        if self.config.audience:
            params["audience"] = self.config.audience
        if code_verifier:
            params["code_challenge"] = _code_challenge(code_verifier)
            params["code_challenge_method"] = "S256"
        url = httpx.URL(authorization_endpoint, params=params)
        return {"type": "redirect", "url": str(url)}

    async def _exchange_code(self, code: str, redirect_uri: str, code_verifier: Optional[str]) -> Dict[str, Any]:
        metadata = await self._metadata_client()
        token_endpoint = metadata.get("token_endpoint")
        if not token_endpoint:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OIDC token endpoint missing")
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.config.client_id,
        }
        auth = None
        if self.config.client_secret:
            secret_value = self.config.client_secret.get_secret_value()
            auth = httpx.BasicAuth(self.config.client_id, secret_value)
        if code_verifier:
            data["code_verifier"] = code_verifier
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(token_endpoint, data=data, auth=auth)
            if resp.status_code >= 400:
                body = resp.text
                self._logger.error(
                    "OIDC token exchange failed for provider '%s': %s",
                    self.name,
                    body.strip() or resp.status_code,
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC token exchange failed")
            payload = resp.json()
        return payload

    def _jwks(self, metadata: Dict[str, Any]) -> PyJWKClient:
        if self._jwks_client:
            return self._jwks_client
        jwks_uri = metadata.get("jwks_uri")
        if not jwks_uri:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="OIDC JWKS URI missing")
        self._jwks_client = PyJWKClient(jwks_uri)
        return self._jwks_client

    async def complete(self, request: Request, session: AsyncSession) -> AuthResult:
        params = request.query_params
        code = params.get("code")
        state_token = params.get("state")
        if not code or not state_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing authorization response")
        try:
            state_data = verify_state(state_token)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        redirect_uri = self._redirect_uri(request)
        token_payload = await self._exchange_code(code, redirect_uri, state_data.get("code_verifier"))
        id_token = token_payload.get("id_token")
        if not id_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC id_token missing")
        metadata = await self._metadata_client()
        signing_key = self._jwks(metadata).get_signing_key_from_jwt(id_token)
        audience = self.config.audience or self.config.client_id
        supported_algs = metadata.get("id_token_signing_alg_values_supported", ["RS256"])
        if isinstance(supported_algs, str):
            supported_algs = [supported_algs]
        header = jwt.get_unverified_header(id_token)
        token_alg = header.get("alg")
        if token_alg and token_alg not in supported_algs:
            supported_algs = [token_alg, *[alg for alg in supported_algs if alg != token_alg]]
        try:
            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=supported_algs,
                audience=audience,
                issuer=metadata.get("issuer"),
                options={"verify_at_hash": False},
            )
        except jwt.PyJWTError as exc:
            raw_claims: Dict[str, Any] | None = None
            try:
                body = id_token.split(".")[1]
                padded = body + "=" * (-len(body) % 4)
                raw_claims = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
            except Exception:  # pragma: no cover - diagnostic path
                raw_claims = None
            self._logger.error(
                "OIDC token validation failed for provider '%s': %s | audience=%s issuer=%s claims=%s",
                self.name,
                exc,
                audience,
                metadata.get("issuer"),
                raw_claims,
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC token validation failed") from exc

        nonce = state_data.get("nonce")
        if nonce and claims.get("nonce") != nonce:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC nonce mismatch")

        mapping = _default_claims(self.config)
        username = claims.get(mapping["username"])
        display_name = claims.get(mapping["display_name"], username)
        email = claims.get(mapping["email"])
        if not username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OIDC username missing")

        groups: list[str] = []
        if self.config.group_claim:
            raw_groups = claims.get(self.config.group_claim)
            if isinstance(raw_groups, str):
                groups = [raw_groups]
            elif isinstance(raw_groups, (list, tuple)):
                groups = [str(item) for item in raw_groups]

        roles = set(self.default_roles)
        for group in groups:
            mapped = self.config.role_mappings.get(group)
            if mapped:
                roles.update(mapped)

        attributes: Dict[str, Any] = {"claims": claims}

        return AuthResult(
            user_external_id=str(claims.get("sub")),
            username=username,
            email=email,
            display_name=display_name,
            provider_name=self.name,
            attributes=attributes,
            roles=sorted(roles),
        )
