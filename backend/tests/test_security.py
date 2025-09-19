import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch


class SecurityBasicsTests(unittest.TestCase):
    def test_password_roundtrip(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": "sqlite+aiosqlite:///./data/app.db"}):
            from app.security.passwords import hash_password, verify_password

            plain = "s3cret!"
            hashed = hash_password(plain)
            self.assertNotEqual(plain, hashed)
            self.assertTrue(verify_password(plain, hashed))
            self.assertFalse(verify_password("wrong", hashed))

    def test_access_token_payload(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": "sqlite+aiosqlite:///./data/app.db"}):
            from app.security.tokens import create_token_bundle, decode_token

            bundle = create_token_bundle(
                user_id="user-123",
                roles=["toolkit.user"],
                identity_provider="local",
                session_id="session-1",
            )
            payload = decode_token(bundle.access_token)
            self.assertEqual(payload["sub"], "user-123")
            self.assertIn("toolkit.user", payload["roles"])
            self.assertEqual(payload["provider"], "local")
            self.assertEqual(payload["sid"], "session-1")
            self.assertLess(datetime.now(timezone.utc).timestamp(), payload["exp"])


if __name__ == "__main__":
    unittest.main()
