import json
import unittest
from typing import Dict
from unittest.mock import patch

from app.toolkits.registry import (
    ToolkitCreate,
    ToolkitUpdate,
    create_toolkit,
    get_toolkit,
    list_toolkits,
    update_toolkit,
)


class FakeRedis:
    def __init__(self) -> None:
        self._data: Dict[str, Dict[str, str]] = {}

    def hset(self, key: str, field: str, value: str) -> None:
        self._data.setdefault(key, {})[field] = value

    def hget(self, key: str, field: str) -> str | None:
        return self._data.get(key, {}).get(field)

    def hvals(self, key: str):
        return list(self._data.get(key, {}).values())

    def hdel(self, key: str, field: str) -> int:
        if key not in self._data:
            return 0
        return 1 if self._data[key].pop(field, None) is not None else 0


class ToolkitRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_redis = FakeRedis()
        patcher = patch("app.toolkits.registry.get_redis", return_value=self.fake_redis)
        self.addCleanup(patcher.stop)
        patcher.start()

    def _payload(self, slug: str = "demo", enabled: bool = True) -> ToolkitCreate:
        return ToolkitCreate(
            slug=slug,
            name="Demo",
            description="Demo toolkit",
            base_path="/toolkits/demo",
            enabled=enabled,
        )

    def test_create_toolkit_persists_record(self) -> None:
        payload = self._payload()
        record = create_toolkit(payload)
        self.assertEqual(record.slug, payload.slug)
        stored = get_toolkit(payload.slug)
        self.assertIsNotNone(stored)
        self.assertEqual(stored.name, "Demo")
        self.assertEqual(len(list_toolkits()), 1)

    def test_update_toolkit_changes_enabled_state(self) -> None:
        payload = self._payload(enabled=False)
        create_toolkit(payload)
        updated = update_toolkit(payload.slug, ToolkitUpdate(enabled=True))
        self.assertIsNotNone(updated)
        self.assertTrue(updated.enabled)

    def test_create_twice_rejected(self) -> None:
        payload = self._payload()
        create_toolkit(payload)
        with self.assertRaises(ValueError):
            create_toolkit(payload)

    def test_redis_payload_schema(self) -> None:
        payload = self._payload()
        create_toolkit(payload)
        key = "sretoolbox:toolkits:registry"
        raw = self.fake_redis.hget(key, payload.slug)
        self.assertIsNotNone(raw)
        stored = json.loads(raw)
        self.assertEqual(stored["slug"], payload.slug)
        self.assertEqual(stored["origin"], "custom")
