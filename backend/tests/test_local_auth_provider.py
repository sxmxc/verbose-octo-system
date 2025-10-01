import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException, status

from app.config import LocalAuthProvider as LocalAuthConfig
from app.security.providers.local import LocalAuthProvider


class LocalAuthProviderThrottleTests(unittest.IsolatedAsyncioTestCase):
    async def test_active_lockout_blocks_login(self) -> None:
        provider = LocalAuthProvider(
            LocalAuthConfig(name="local", max_attempts=5, window_seconds=60, lockout_seconds=300)
        )
        request = SimpleNamespace(
            json=AsyncMock(return_value={"username": "alice", "password": "secret"}),
            client=SimpleNamespace(host="198.51.100.10"),
            headers={"user-agent": "pytest"},
        )
        session = AsyncMock()

        with (
            patch("app.security.providers.local.get_redis", return_value=Mock()) as mock_get_redis,
            patch("app.security.providers.local.check_lockout", return_value=180),
            patch("app.security.providers.local.UserService") as user_service_cls,
            patch("app.security.providers.local.AuditService") as audit_service_cls,
        ):
            user_service = user_service_cls.return_value
            user_service.get_by_username = AsyncMock()
            audit_service = audit_service_cls.return_value
            audit_service.log = AsyncMock()

            with self.assertRaises(HTTPException) as exc:
                await provider.complete(request, session)

            self.assertEqual(exc.exception.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            audit_calls = [call.kwargs["event"] for call in audit_service.log.await_args_list]
            self.assertEqual(audit_calls, ["auth.login.lockout"])
            user_service.get_by_username.assert_not_awaited()
            mock_get_redis.assert_called_once()

    async def test_failed_login_triggers_lockout(self) -> None:
        provider = LocalAuthProvider(
            LocalAuthConfig(name="local", max_attempts=3, window_seconds=120, lockout_seconds=600)
        )
        user = SimpleNamespace(
            id="user-1",
            username="alice",
            email="alice@example.com",
            display_name="Alice",
            roles=[SimpleNamespace(slug="toolkit.user")],
            password_hash="hashed",
            is_active=True,
        )
        request = SimpleNamespace(
            json=AsyncMock(return_value={"username": "alice", "password": "bad"}),
            client=SimpleNamespace(host="203.0.113.15"),
            headers={"user-agent": "pytest"},
        )
        session = AsyncMock()

        with (
            patch("app.security.providers.local.get_redis", return_value=Mock()) as mock_get_redis,
            patch("app.security.providers.local.check_lockout", return_value=0),
            patch("app.security.providers.local.record_failure", return_value=(True, 500)) as record_failure,
            patch("app.security.providers.local.verify_password", return_value=False),
            patch("app.security.providers.local.UserService") as user_service_cls,
            patch("app.security.providers.local.AuditService") as audit_service_cls,
        ):
            user_service = user_service_cls.return_value
            user_service.get_by_username = AsyncMock(return_value=user)
            audit_service = audit_service_cls.return_value
            audit_service.log = AsyncMock()

            with self.assertRaises(HTTPException) as exc:
                await provider.complete(request, session)

            self.assertEqual(exc.exception.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            events = [call.kwargs["event"] for call in audit_service.log.await_args_list]
            self.assertIn("auth.login.failure", events)
            self.assertIn("auth.login.lockout", events)
            record_failure.assert_called_once_with(mock_get_redis.return_value, "alice", provider._throttle_config())

    async def test_success_resets_attempt_counter(self) -> None:
        provider = LocalAuthProvider(
            LocalAuthConfig(name="local", max_attempts=3, window_seconds=120, lockout_seconds=600)
        )
        user = SimpleNamespace(
            id="user-1",
            username="alice",
            email="alice@example.com",
            display_name="Alice",
            roles=[SimpleNamespace(slug="toolkit.user")],
            password_hash="hashed",
            is_active=True,
        )
        request = SimpleNamespace(
            json=AsyncMock(return_value={"username": "alice", "password": "good"}),
            client=SimpleNamespace(host="198.51.100.7"),
            headers={"user-agent": "pytest"},
        )
        session = AsyncMock()

        with (
            patch("app.security.providers.local.get_redis", return_value=Mock()) as mock_get_redis,
            patch("app.security.providers.local.check_lockout", return_value=0),
            patch("app.security.providers.local.record_failure") as record_failure,
            patch("app.security.providers.local.reset_attempts") as reset_attempts,
            patch("app.security.providers.local.verify_password", return_value=True),
            patch("app.security.providers.local.UserService") as user_service_cls,
            patch("app.security.providers.local.AuditService") as audit_service_cls,
        ):
            user_service = user_service_cls.return_value
            user_service.get_by_username = AsyncMock(return_value=user)
            user_service.mark_login = AsyncMock()
            audit_service = audit_service_cls.return_value
            audit_service.log = AsyncMock()

            result = await provider.complete(request, session)

            self.assertEqual(result.username, "alice")
            reset_attempts.assert_called_once_with(mock_get_redis.return_value, "alice")
            record_failure.assert_not_called()


if __name__ == "__main__":
    unittest.main()
