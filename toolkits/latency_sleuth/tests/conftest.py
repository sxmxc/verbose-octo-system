from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterator, List

import pytest

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT))

from toolkit_runtime import jobs as job_store
from toolkit_runtime import redis as redis_module
from toolkits.latency_sleuth.backend import storage as storage_module


class FakeRedis:
    def __init__(self) -> None:
        self._hashes: Dict[str, Dict[str, str]] = defaultdict(dict)
        self._lists: Dict[str, List[str]] = defaultdict(list)

    class _Pipeline:
        def __init__(self, redis: "FakeRedis") -> None:
            self._redis = redis
            self._commands: List[tuple] = []

        def __enter__(self) -> "FakeRedis._Pipeline":
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            self._commands.clear()
            return False

        # Redis pipeline API (no-op implementations for watch/unwatch)
        def watch(self, *names: str) -> None:  # pragma: no cover - compatibility shim
            return None

        def unwatch(self) -> None:  # pragma: no cover - compatibility shim
            return None

        def hget(self, name: str, key: str) -> str | None:
            return self._redis.hget(name, key)

        def multi(self) -> None:  # pragma: no cover - compatibility shim
            self._commands.clear()

        def hset(self, name: str, key: str, value: str) -> None:
            self._commands.append(("hset", name, key, value))

        def execute(self) -> List[None]:
            for command, name, key, value in self._commands:
                if command == "hset":
                    self._redis.hset(name, key, value)
            self._commands.clear()
            return []

    # Basic API used by the code under test
    # Hash operations
    def hset(self, name: str, key: str, value: str) -> None:
        self._hashes[name][key] = value

    def hget(self, name: str, key: str) -> str | None:
        return self._hashes[name].get(key)

    def hvals(self, name: str) -> List[str]:
        return list(self._hashes[name].values())

    def hdel(self, name: str, key: str) -> int:
        if key in self._hashes[name]:
            del self._hashes[name][key]
            return 1
        return 0

    # List operations
    def lpush(self, name: str, value: str) -> None:
        self._lists[name].insert(0, value)

    def lrange(self, name: str, start: int, stop: int) -> List[str]:
        values = self._lists[name]
        if stop == -1:
            return values[start:]
        return values[start : stop + 1]

    def ltrim(self, name: str, start: int, stop: int) -> None:
        values = self._lists[name]
        self._lists[name] = values[start : stop + 1]

    def delete(self, name: str) -> None:
        self._hashes.pop(name, None)
        self._lists.pop(name, None)

    def scan_iter(self, pattern: str) -> Iterator[str]:
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            for key in list(self._lists.keys()):
                if key.startswith(prefix):
                    yield key
        else:
            if pattern in self._lists:
                yield pattern

    def flushall(self) -> None:
        self._hashes.clear()
        self._lists.clear()

    def pipeline(self):
        return self._Pipeline(self)


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    fake = FakeRedis()

    monkeypatch.setattr(redis_module, "get_redis", lambda: fake)
    monkeypatch.setattr(job_store, "get_redis", lambda: fake)
    monkeypatch.setattr(storage_module, "get_redis", lambda: fake)

    return fake
