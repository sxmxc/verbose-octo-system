import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch, call

from fastapi import HTTPException, status

from app.config import LocalAuthProvider as LocalAuthConfig
from app.security.providers.base import AuthResult
from app.security.providers.local import LocalAuthProvider


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.ttls: dict[str, int] = {}

    def incr(self, key: str) -> int:
        value = int(self.store.get(key, "0")) + 1
        self.store[key] = str(value)
        return value

    def expire(self, key: str, seconds: int) -> bool:
        if key in self.store:
            self.ttls[key] = seconds
            return True
        return False

    def setex(self, key: str, seconds: int, value: str) -> bool:
        self.store[key] = value
        self.ttls[key] = seconds
        return True

    def ttl(self, key: str) -> int:
        if key not in self.store:
            return -2
        return self.ttls.get(key, -1)

    def delete(self, *keys: str) -> int:
        removed = 0
        for key in keys:
            if key in self.store:
                self.store.pop(key, None)
                self.ttls.pop(key, None)
                removed += 1
        return removed

    def get(self, key: str) -> str | None:
        return self.store.get(key)


class LocalAuthProviderThrottlingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.fake_redis = FakeRedis()

        self.redis_patcher = patch("app.security.providers.local.get_redis", return_value=self.fake_redis)
        self.addCleanup(self.redis_patcher.stop)
        self.redis_patcher.start()

        self.audit_service = SimpleNamespace(log=AsyncMock())
        self.audit_patcher = patch("app.security.providers.local.AuditService", return_value=self.audit_service)
        self.addCleanup(self.audit_patcher.stop)
        self.audit_patcher.start()

        self.user_service = SimpleNamespace(
            get_by_username=AsyncMock(),
            mark_login=AsyncMock(),
        )
        self.user_patcher = patch("app.security.providers.local.UserService", return_value=self.user_service)
        self.addCleanup(self.user_patcher.stop)
        self.user_patcher.start()

        self.session = AsyncMock()
        self.user = SimpleNamespace(
            id="user-1",
            username="alice",
            password_hash="hashed-password",
            email="alice@example.com",
            display_name="Alice",
            is_active=True,
            roles=[SimpleNamespace(slug="toolkit.user")],
        )
        self.user_service.get_by_username.return_value = self.user

        config = LocalAuthConfig(
            name="local",
            allow_registration=False,
            max_failed_attempts=3,
            failure_window_seconds=60,
            lockout_seconds=120,
        )
        self.provider = LocalAuthProvider(config)

    def _make_request(self, username: str, password: str, ip: str = "127.0.0.1"):
        class RequestStub:
            def __init__(self, user: str, secret: str, host: str) -> None:
                self._payload = {"username": user, "password": secret}
                self.client = SimpleNamespace(host=host)
                self.headers = {"user-agent": "pytest"}

            async def json(self):
                return self._payload

        return RequestStub(username, password, ip)

    async def test_throttle_engages_after_max_failures(self) -> None:
        with patch("app.security.providers.local.verify_password", return_value=False):
            for _ in range(self.provider.config.max_failed_attempts - 1):
                request = self._make_request("alice", "wrong")
                with self.assertRaises(HTTPException) as exc:
                    await self.provider.complete(request, self.session)
                self.assertEqual(exc.exception.status_code, status.HTTP_401_UNAUTHORIZED)

            triggering_request = self._make_request("alice", "wrong")
            with self.assertRaises(HTTPException) as exc:
                await self.provider.complete(triggering_request, self.session)

            self.assertEqual(exc.exception.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            self.assertEqual(exc.exception.detail, "Too many login attempts. Try again later.")
            self.assertIn("Retry-After", exc.exception.headers)

            throttled_request = self._make_request("alice", "wrong")
            with self.assertRaises(HTTPException) as throttled_exc:
                await self.provider.complete(throttled_request, self.session)

        self.assertEqual(throttled_exc.exception.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(throttled_exc.exception.detail, "Too many login attempts. Try again later.")
        self.assertIn("Retry-After", throttled_exc.exception.headers)

        throttle_events = [
            call
            for call in self.audit_service.log.await_args_list
            if call.kwargs.get("event") == "auth.login.throttled"
        ]
        self.assertEqual(len(throttle_events), 1)
        payload = throttle_events[0].kwargs["payload"]
        self.assertEqual(payload["provider"], "local")
        self.assertEqual(payload["username"], "alice")
        self.assertEqual(payload["reason"], "rate_limited")

    async def test_success_resets_failure_counter(self) -> None:
        with patch(
            "app.security.providers.local.verify_password",
            side_effect=[False, False, True],
        ):
            for index in range(3):
                request = self._make_request("alice", "maybe")
                if index < 2:
                    with self.assertRaises(HTTPException) as exc:
                        await self.provider.complete(request, self.session)
                    self.assertEqual(exc.exception.status_code, status.HTTP_401_UNAUTHORIZED)
                else:
                    result = await self.provider.complete(request, self.session)
                    self.assertIsInstance(result, AuthResult)

        with patch("app.security.providers.local.verify_password", return_value=False):
            for attempt in range(2):
                request = self._make_request("alice", "wrong-again")
                with self.assertRaises(HTTPException) as exc:
                    await self.provider.complete(request, self.session)
                self.assertEqual(exc.exception.status_code, status.HTTP_401_UNAUTHORIZED)

            request = self._make_request("alice", "still-wrong")
            with self.assertRaises(HTTPException) as exc:
                await self.provider.complete(request, self.session)

        self.assertEqual(exc.exception.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


if __name__ == "__main__":
    unittest.main()
