import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import Request

from app.routes import auth
from app.security.tokens import TokenBundle


class AuthRouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/auth/providers/local/callback",
            "headers": [(b"user-agent", b"pytest")],
        }
        self.request = Request(scope)
        self.session = AsyncMock()
        self.session.commit = AsyncMock()
        self.session.rollback = AsyncMock()
        self.bundle = TokenBundle(
            access_token="access",
            access_expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            refresh_token="refresh",
            refresh_expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            session_id="session-id",
        )
        self.user = SimpleNamespace(
            id="user-1",
            username="alice",
            display_name="Alice",
            email="alice@example.com",
            roles=[SimpleNamespace(slug="toolkit.user")],
            is_superuser=False,
        )

    async def test_complete_provider_login_happy_path(self):
        provider = SimpleNamespace(complete=AsyncMock(return_value="auth-result"))
        with patch.object(auth, "AuthService") as mock_service_cls:
            service = mock_service_cls.return_value
            service.resolve_user = AsyncMock(return_value=self.user)
            service.issue_tokens = AsyncMock(return_value=self.bundle)

            user, bundle, payload = await auth._complete_provider_login(provider, self.request, self.session)

        provider.complete.assert_awaited_once_with(self.request, self.session)
        service.resolve_user.assert_awaited_once_with(
            provider,
            "auth-result",
            source_ip=None,
            user_agent="pytest",
        )
        service.issue_tokens.assert_awaited_once_with(self.user, provider, client_info="pytest")
        self.session.commit.assert_awaited_once()
        self.session.rollback.assert_not_called()

        expected_payload = auth._serialize_login_payload(self.user, self.bundle)
        self.assertEqual(payload, expected_payload)
        self.assertIs(user, self.user)
        self.assertIs(bundle, self.bundle)

    async def test_complete_provider_login_rolls_back_on_error(self):
        provider = SimpleNamespace(complete=AsyncMock(side_effect=RuntimeError("boom")))
        with patch.object(auth, "AuthService") as mock_service_cls:
            service = mock_service_cls.return_value
            service.resolve_user = AsyncMock()
            service.issue_tokens = AsyncMock()

            with self.assertRaises(RuntimeError):
                await auth._complete_provider_login(provider, self.request, self.session)

        service.resolve_user.assert_not_called()
        service.issue_tokens.assert_not_called()
        self.session.commit.assert_not_called()
        self.session.rollback.assert_awaited_once()
