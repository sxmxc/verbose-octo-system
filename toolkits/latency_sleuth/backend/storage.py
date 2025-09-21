from __future__ import annotations

import json
from datetime import timedelta
from typing import Iterable, List, Optional
from uuid import uuid4

from toolkit_runtime.redis import get_redis, redis_key
from redis.exceptions import WatchError

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
        next_run_at=now,
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
    next_run_at = current.next_run_at
    if (
        payload.interval_seconds is not None
        and payload.interval_seconds != current.interval_seconds
    ):
        next_run_at = utcnow()

    updated = ProbeTemplate.model_validate({
        **data,
        "id": template_id,
        "created_at": current.created_at,
        "updated_at": utcnow(),
        "next_run_at": next_run_at,
    })
    redis = get_redis()
    redis.hset(TEMPLATES_KEY, template_id, _dump(_template_to_record(updated)))
    return updated


def _compute_next_run(template: ProbeTemplate, *, base_time=None) -> Optional[str]:
    if template.interval_seconds <= 0:
        return None
    origin = base_time or utcnow()
    next_run = origin + timedelta(seconds=template.interval_seconds)
    return next_run.isoformat()


def reserve_template_for_run(template_id: str, *, now=None) -> Optional[ProbeTemplate]:
    timestamp = now or utcnow()
    redis = get_redis()

    while True:
        with redis.pipeline() as pipe:
            try:
                pipe.watch(TEMPLATES_KEY)
                raw = pipe.hget(TEMPLATES_KEY, template_id)
                if not raw:
                    pipe.unwatch()
                    return None

                record = _load(raw)
                template = ProbeTemplate.model_validate(record)

                current_next = template.next_run_at or template.created_at
                if current_next and current_next > timestamp:
                    pipe.unwatch()
                    return None

                record["next_run_at"] = _compute_next_run(template, base_time=timestamp)
                record["updated_at"] = timestamp.isoformat()

                pipe.multi()
                pipe.hset(TEMPLATES_KEY, template_id, _dump(record))
                pipe.execute()
                return ProbeTemplate.model_validate(record)
            except WatchError:
                continue


def list_due_templates(limit: Optional[int] = None, *, now=None) -> List[ProbeTemplate]:
    timestamp = now or utcnow()
    due: List[ProbeTemplate] = []
    for template in list_templates():
        next_run = template.next_run_at or template.created_at
        if not next_run or next_run <= timestamp:
            due.append(template)
            if limit is not None and len(due) >= limit:
                break
    return due


def bootstrap_schedule(*, now=None) -> int:
    timestamp = now or utcnow()
    redis = get_redis()
    updated = 0
    for template in list_templates():
        if template.next_run_at is not None:
            continue
        record = _template_to_record(template)
        record["next_run_at"] = timestamp.isoformat()
        redis.hset(TEMPLATES_KEY, template.id, _dump(record))
        updated += 1
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
