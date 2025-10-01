import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch, call

from fastapi import HTTPException, status

from app.security.tokens import TokenBundle
from app.services.auth import AuthService


class AuthServiceRefreshTokenTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.session = AsyncMock()
        self.session.flush = AsyncMock()
        self.session.delete = AsyncMock()

        session_service_patcher = patch("app.services.auth.SessionService")
        user_service_patcher = patch("app.services.auth.UserService")
        self.addCleanup(session_service_patcher.stop)
        self.addCleanup(user_service_patcher.stop)
        self.mock_session_service_cls = session_service_patcher.start()
        self.mock_user_service_cls = user_service_patcher.start()

        self.session_service = SimpleNamespace(
            get_by_token_hash=AsyncMock(),
            create_session=AsyncMock(),
        )
        self.user_service = SimpleNamespace(
            get_by_id=AsyncMock(),
            audit=AsyncMock(),
        )

        self.mock_session_service_cls.return_value = self.session_service
        self.mock_user_service_cls.return_value = self.user_service

        self.service = AuthService(self.session)

    async def test_refresh_tokens_rejects_missing_token_use(self) -> None:
        with patch("app.services.auth.decode_token", return_value={"sub": "user-1", "typ": "refresh"}):
            with self.assertRaises(HTTPException) as exc:
                await self.service.refresh_tokens("refresh-token")

        self.assertEqual(exc.exception.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(exc.exception.detail, "Refresh token invalid")
        self.session_service.get_by_token_hash.assert_not_awaited()

    async def test_refresh_tokens_rejects_incorrect_typ(self) -> None:
        payload = {"sub": "user-1", "token_use": "refresh", "typ": "access"}
        with patch("app.services.auth.decode_token", return_value=payload):
            with self.assertRaises(HTTPException) as exc:
                await self.service.refresh_tokens("refresh-token")

        self.assertEqual(exc.exception.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(exc.exception.detail, "Refresh token invalid")
        self.session_service.get_by_token_hash.assert_not_awaited()

    async def test_refresh_tokens_successful_with_valid_claims(self) -> None:
        now = datetime.now(timezone.utc)
        record = SimpleNamespace(
            id="session-record",
            user_id="user-1",
            revoked_at=None,
            expires_at=now + timedelta(days=7),
            client_info=None,
        )
        original_expiry = record.expires_at
        self.session_service.get_by_token_hash.return_value = record

        user = SimpleNamespace(
            id="user-1",
            roles=[SimpleNamespace(slug="toolkit.user")],
            is_active=True,
            display_name="Alice",
            username="alice",
        )
        self.user_service.get_by_id.return_value = user

        bundle = TokenBundle(
            access_token="access-token",
            access_expires_at=now + timedelta(minutes=5),
            refresh_token="new-refresh-token",
            refresh_expires_at=now + timedelta(days=14),
            session_id="session-id",
        )

        payload = {
            "sub": "user-1",
            "provider": "local",
            "sid": "session-id",
            "token_use": "refresh",
            "typ": "refresh",
        }

        with patch("app.services.auth.decode_token", return_value=payload), \
            patch("app.services.auth.hash_token", side_effect=lambda value: f"hash:{value}") as mock_hash, \
            patch("app.services.auth.is_token_expired", return_value=False) as mock_is_expired, \
            patch("app.services.auth.create_token_bundle", return_value=bundle) as mock_create_bundle:
            result = await self.service.refresh_tokens("existing-refresh-token")

        self.assertIs(result, bundle)
        self.session_service.get_by_token_hash.assert_awaited_once_with("hash:existing-refresh-token")
        mock_is_expired.assert_called_once_with(original_expiry)
        self.user_service.get_by_id.assert_awaited_once_with("user-1")
        mock_create_bundle.assert_called_once_with(
            user_id="user-1",
            roles=["toolkit.user"],
            identity_provider="local",
            session_id="session-id",
            extra_claims={"name": "Alice"},
        )
        self.assertGreaterEqual(len(mock_hash.call_args_list), 2)
        mock_hash.assert_has_calls([call("existing-refresh-token"), call("new-refresh-token")])
        self.assertEqual(record.refresh_token_hash, "hash:new-refresh-token")
        self.assertEqual(record.expires_at, bundle.refresh_expires_at)
        self.session.flush.assert_awaited_once()
        self.user_service.audit.assert_awaited_once_with(
            user=user,
            event="auth.token.refresh",
            payload={"provider": "local", "session_id": "session-id"},
            source_ip=None,
            user_agent=None,
        )


if __name__ == "__main__":
    unittest.main()
