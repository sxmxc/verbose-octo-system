import json
import unittest
from contextlib import contextmanager
from typing import Dict
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app import models  # noqa: F401 - ensure model metadata is loaded
from app.toolkits.registry import (
    ToolkitCreate,
    ToolkitUpdate,
    clear_toolkit_removal,
    create_toolkit,
    delete_toolkit,
    get_toolkit,
    is_toolkit_removed,
    list_toolkits,
    update_toolkit,
)


class FakeRedis:
    def __init__(self) -> None:
        self._data: Dict[str, Dict[str, str]] = {}

    def hset(self, key: str, field: str | None = None, value: str | None = None, mapping: Dict[str, str] | None = None) -> None:
        bucket = self._data.setdefault(key, {})
        if mapping:
            bucket.update(mapping)
        elif field is not None and value is not None:
            bucket[field] = value

    def hget(self, key: str, field: str) -> str | None:
        return self._data.get(key, {}).get(field)

    def hvals(self, key: str):
        return list(self._data.get(key, {}).values())

    def hdel(self, key: str, field: str) -> int:
        if key not in self._data:
            return 0
        return 1 if self._data[key].pop(field, None) is not None else 0

    def delete(self, key: str) -> int:
        return 1 if self._data.pop(key, None) is not None else 0


class ToolkitRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fake_redis = FakeRedis()
        patcher = patch("app.toolkits.registry.get_redis", return_value=self.fake_redis)
        self.addCleanup(patcher.stop)
        patcher.start()

        self.engine = create_engine("sqlite:///:memory:", future=True)
        self.addCleanup(self.engine.dispose)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)

        @contextmanager
        def session_scope():
            session = self.Session()
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

        session_patcher = patch("app.toolkits.registry.get_sync_session", session_scope)
        self.addCleanup(session_patcher.stop)
        session_patcher.start()

    def _payload(self, slug: str = "demo", enabled: bool = True) -> ToolkitCreate:
        return ToolkitCreate(
            slug=slug,
            name="Demo",
            description="Demo toolkit",
            base_path=f"/toolkits/{slug}",
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

    def test_list_toolkits_backfills_cache_from_db(self) -> None:
        payload = self._payload()
        create_toolkit(payload)
        # Simulate Redis restart
        self.fake_redis._data.clear()
        toolkits = list_toolkits()
        self.assertEqual(len(toolkits), 1)
        redis_values = self.fake_redis._data.get("sretoolbox:toolkits:registry", {})
        self.assertIn(payload.slug, redis_values)

    def test_delete_bundled_marks_removal(self) -> None:
        payload = self._payload(slug="regex")
        record = create_toolkit(payload, origin="bundled")
        self.assertEqual(record.origin, "bundled")
        deleted = delete_toolkit(payload.slug)
        self.assertTrue(deleted)
        self.assertTrue(is_toolkit_removed(payload.slug))
        registry = self.fake_redis._data.get("sretoolbox:toolkits:registry", {})
        self.assertNotIn(payload.slug, registry)

    def test_clear_removal_allows_reinstall(self) -> None:
        payload = self._payload(slug="regex")
        create_toolkit(payload, origin="bundled")
        delete_toolkit(payload.slug)
        self.assertTrue(is_toolkit_removed(payload.slug))
        clear_toolkit_removal(payload.slug)
        create_toolkit(self._payload(slug="regex"), origin="bundled")
        self.assertFalse(is_toolkit_removed(payload.slug))
