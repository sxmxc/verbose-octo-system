import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.services.audit import AuditService, parse_payload
from app.services.users import UserService


class AuditLoggingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.session = AsyncMock()
        self.session.add = MagicMock()
        self.session.flush = AsyncMock()
        self.session.get = AsyncMock(return_value=None)
        self.session.execute = AsyncMock(return_value=SimpleNamespace(rowcount=0))

    async def test_user_service_audit_defaults_to_user_target(self) -> None:
        service = UserService(self.session)
        actor = SimpleNamespace(id="user-123")
        await service.audit(user=actor, event="user.status.update", payload={"from": True, "to": False})

        self.session.add.assert_called_once()
        record = self.session.add.call_args[0][0]
        self.assertEqual(record.user_id, "user-123")
        self.assertEqual(record.target_type, "user")
        self.assertEqual(record.target_id, "user-123")
        self.assertEqual(record.severity, "warning")

    async def test_audit_service_log_stores_payload(self) -> None:
        service = AuditService(self.session)
        actor = SimpleNamespace(id="user-456")
        record = await service.log(
            actor=actor,
            event="auth.login.success",
            payload={"provider": "local"},
            source_ip="127.0.0.1",
            user_agent="pytest",
        )

        self.session.add.assert_called()
        self.session.flush.assert_awaited()
        self.assertEqual(record.user_id, "user-456")
        self.assertEqual(record.source_ip, "127.0.0.1")
        self.assertEqual(parse_payload(record), {"provider": "local"})

    async def test_set_retention_days_validates(self) -> None:
        service = AuditService(self.session)
        with self.assertRaises(ValueError):
            await service.set_retention_days(0)

    async def test_set_retention_days_updates_store(self) -> None:
        service = AuditService(self.session)
        await service.set_retention_days(45)
        self.session.add.assert_called()

    async def test_purge_expired_uses_configured_days(self) -> None:
        service = AuditService(self.session)
        self.session.execute.return_value = SimpleNamespace(rowcount=3)
        removed = await service.purge_expired(retention_days=30)
        self.assertEqual(removed, 3)
        self.session.execute.assert_awaited()


class ParsePayloadTests(unittest.TestCase):
    def test_parse_payload_handles_invalid_json(self) -> None:
        dummy = SimpleNamespace(payload="{not-json}")
        parsed = parse_payload(dummy)
        self.assertEqual(parsed, {"raw": "{not-json}"})


if __name__ == "__main__":
    unittest.main()
