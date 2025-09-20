from __future__ import annotations

import json
from typing import Iterable, List, Optional
from uuid import uuid4

from app.core.redis import get_redis, redis_key

from .models import (
    HeatmapCell,
    LatencyHeatmap,
    ProbeExecutionSummary,
    ProbeHistoryEntry,
    ProbeTemplate,
    ProbeTemplateCreate,
    ProbeTemplateUpdate,
    utcnow,
)


TEMPLATES_KEY = redis_key("toolkits", "latency_sleuth", "templates")
HISTORY_KEY_PREFIX = redis_key("toolkits", "latency_sleuth", "history")
MAX_HISTORY_ENTRIES = 96
MAX_HEATMAP_CELLS = 48
DEFAULT_HEATMAP_COLUMNS = 6


def _history_key(template_id: str) -> str:
    return f"{HISTORY_KEY_PREFIX}:{template_id}"


def _dump(data) -> str:
    return json.dumps(data)


def _load(raw: str):
    return json.loads(raw)


def _template_to_record(template: ProbeTemplate) -> dict:
    return template.model_dump(mode="json")


def _record_to_template(record: dict) -> ProbeTemplate:
    return ProbeTemplate.model_validate(record)


def _summary_to_entry(summary: ProbeExecutionSummary) -> ProbeHistoryEntry:
    return ProbeHistoryEntry(template_id=summary.template_id, recorded_at=utcnow(), summary=summary)


def create_template(payload: ProbeTemplateCreate) -> ProbeTemplate:
    redis = get_redis()
    template_id = str(uuid4())
    now = utcnow()
    template = ProbeTemplate(
        id=template_id,
        created_at=now,
        updated_at=now,
        **payload.model_dump(),
    )
    redis.hset(TEMPLATES_KEY, template_id, _dump(_template_to_record(template)))
    return template


def list_templates() -> List[ProbeTemplate]:
    redis = get_redis()
    values = redis.hvals(TEMPLATES_KEY) or []
    return [_record_to_template(_load(value)) for value in values]


def get_template(template_id: str) -> Optional[ProbeTemplate]:
    redis = get_redis()
    raw = redis.hget(TEMPLATES_KEY, template_id)
    if not raw:
        return None
    return _record_to_template(_load(raw))


def update_template(template_id: str, payload: ProbeTemplateUpdate) -> Optional[ProbeTemplate]:
    current = get_template(template_id)
    if not current:
        return None
    data = current.model_dump()
    updates = payload.model_dump(exclude_none=True, exclude_unset=True)
    data.update(updates)
    updated = ProbeTemplate.model_validate({
        **data,
        "id": template_id,
        "created_at": current.created_at,
        "updated_at": utcnow(),
    })
    redis = get_redis()
    redis.hset(TEMPLATES_KEY, template_id, _dump(_template_to_record(updated)))
    return updated


def delete_template(template_id: str) -> bool:
    redis = get_redis()
    removed = redis.hdel(TEMPLATES_KEY, template_id)
    redis.delete(_history_key(template_id))
    return bool(removed)


def record_probe_result(summary: ProbeExecutionSummary) -> ProbeHistoryEntry:
    redis = get_redis()
    entry = _summary_to_entry(summary)
    key = _history_key(summary.template_id)
    redis.lpush(key, _dump(entry.model_dump(mode="json")))
    redis.ltrim(key, 0, MAX_HISTORY_ENTRIES - 1)
    return entry


def list_history(template_id: str, limit: int = MAX_HISTORY_ENTRIES) -> List[ProbeHistoryEntry]:
    redis = get_redis()
    raw_values = redis.lrange(_history_key(template_id), 0, limit - 1)
    history: List[ProbeHistoryEntry] = []
    for raw in raw_values:
        history.append(ProbeHistoryEntry.model_validate(_load(raw)))
    return history


def build_heatmap(template_id: str, columns: int = DEFAULT_HEATMAP_COLUMNS) -> LatencyHeatmap:
    history = list_history(template_id, limit=MAX_HEATMAP_CELLS)
    if not history:
        return LatencyHeatmap(template_id=template_id, columns=columns, rows=[])

    samples: List[HeatmapCell] = []
    for entry in reversed(history):
        for sample in entry.summary.samples:
            samples.append(
                HeatmapCell(
                    timestamp=sample.timestamp,
                    latency_ms=sample.latency_ms,
                    breach=sample.breach,
                )
            )
    samples = samples[-MAX_HEATMAP_CELLS:]

    rows: List[List[HeatmapCell]] = []
    if columns <= 0:
        columns = DEFAULT_HEATMAP_COLUMNS
    for index in range(0, len(samples), columns):
        rows.append(samples[index : index + columns])
    return LatencyHeatmap(template_id=template_id, columns=columns, rows=rows)


def reset_storage() -> None:
    """Utility used in tests to clear stored data."""

    redis = get_redis()
    redis.delete(TEMPLATES_KEY)
    history_keys: Iterable[str] = redis.scan_iter(f"{_history_key('*')}")  # type: ignore[arg-type]
    for key in list(history_keys):
        redis.delete(key)
