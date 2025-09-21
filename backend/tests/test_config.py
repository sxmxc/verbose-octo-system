import importlib
import os
import unittest
from unittest import mock

from pydantic import ValidationError

import app.config as config

_GOOD_TEST_SECRET = "unit-test-secret-value-that-is-long-enough-1234567890abcd"


class JwtSettingsEnforcementTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["AUTH_JWT_SECRET"] = _GOOD_TEST_SECRET
        importlib.reload(config)

    def tearDown(self) -> None:
        for key in ("AUTH_JWT_ALGORITHM", "AUTH_JWT_PRIVATE_KEY", "AUTH_JWT_PUBLIC_KEY"):
            os.environ.pop(key, None)
        os.environ["AUTH_JWT_SECRET"] = _GOOD_TEST_SECRET
        importlib.reload(config)

    def test_rejects_default_secret(self) -> None:
        with mock.patch.dict(os.environ, {"AUTH_JWT_SECRET": "change-me"}):
            with self.assertRaises(ValidationError):
                importlib.reload(config)

    def test_rejects_sample_placeholder_secret(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"AUTH_JWT_SECRET": "insecure-development-secret-change-me"},
        ):
            with self.assertRaises(ValidationError):
                importlib.reload(config)

    def test_rejects_short_secret(self) -> None:
        with mock.patch.dict(os.environ, {"AUTH_JWT_SECRET": "short"}):
            with self.assertRaises(ValidationError):
                importlib.reload(config)

    def test_requires_keypair_for_asymmetric_algorithms(self) -> None:
        with mock.patch.dict(
            os.environ,
            {"AUTH_JWT_ALGORITHM": "RS256", "AUTH_JWT_SECRET": _GOOD_TEST_SECRET},
            clear=False,
        ):
            with self.assertRaises(ValidationError):
                importlib.reload(config)

        with mock.patch.dict(
            os.environ,
            {
                "AUTH_JWT_ALGORITHM": "RS256",
                "AUTH_JWT_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\nunit-test\n-----END PRIVATE KEY-----",
                "AUTH_JWT_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\nunit-test\n-----END PUBLIC KEY-----",
                "AUTH_JWT_SECRET": _GOOD_TEST_SECRET,
            },
            clear=False,
        ):
            module = importlib.reload(config)
            self.assertEqual(module.settings.auth_jwt_algorithm.upper(), "RS256")


if __name__ == "__main__":
    unittest.main()
