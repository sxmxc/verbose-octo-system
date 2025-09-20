from __future__ import annotations

import random
from datetime import datetime
from typing import Iterable, List, Optional, Sequence

from .models import (
    NotificationChannel,
    NotificationRule,
    ProbeExecutionSample,
    ProbeExecutionSummary,
    ProbeTemplate,
    utcnow,
)


def _deterministic_latency(template: ProbeTemplate, attempt: int) -> float:
    seed = f"{template.id}:{attempt}:{template.sla_ms}:{template.interval_seconds}"
    rng = random.Random(seed)
    base = rng.uniform(20.0, template.sla_ms * 1.5 if template.sla_ms else 500.0)
    jitter = rng.uniform(-0.1, 0.1) * base
    latency = max(1.0, base + jitter)
    return round(latency, 2)


def _choose_latency(
    template: ProbeTemplate,
    attempt: int,
    overrides: Optional[Sequence[float]] = None,
) -> float:
    if overrides and attempt - 1 < len(overrides):
        return float(overrides[attempt - 1])
    return _deterministic_latency(template, attempt)


def _format_message(latency: float, sla_ms: int) -> str:
    difference = latency - sla_ms
    if difference <= 0:
        return f"{latency:.2f} ms (within SLA)"
    return f"{latency:.2f} ms (breach by {difference:.2f} ms)"


def _should_notify(rule: NotificationRule, breach_count: int) -> bool:
    if rule.threshold == "always":
        return True
    if rule.threshold == "breach":
        return breach_count > 0
    if rule.threshold == "recovery":
        return breach_count == 0
    return False


def execute_probe(
    template: ProbeTemplate,
    sample_size: int,
    overrides: Optional[Sequence[float]] = None,
    clock: Optional[Iterable[datetime]] = None,
) -> ProbeExecutionSummary:
    if sample_size <= 0:
        raise ValueError("sample_size must be positive")

    timestamps = list(clock) if clock else []
    samples: List[ProbeExecutionSample] = []
    for attempt in range(1, sample_size + 1):
        latency = _choose_latency(template, attempt, overrides=overrides)
        timestamp = timestamps[attempt - 1] if attempt - 1 < len(timestamps) else utcnow()
        breach = latency > template.sla_ms
        samples.append(
            ProbeExecutionSample(
                attempt=attempt,
                timestamp=timestamp,
                latency_ms=latency,
                breach=breach,
                message=_format_message(latency, template.sla_ms),
            )
        )

    summary = ProbeExecutionSummary.from_samples(
        template_id=template.id,
        template_name=template.name,
        sla_ms=template.sla_ms,
        samples=samples,
        notified_channels=_select_channels(template.notification_rules, samples),
    )
    return summary


def _select_channels(rules: Iterable[NotificationRule], samples: List[ProbeExecutionSample]) -> List[NotificationChannel]:
    breach_count = sum(1 for sample in samples if sample.breach)
    channels: List[NotificationChannel] = []
    for rule in rules:
        if _should_notify(rule, breach_count):
            channels.append(rule.channel)
    return channels
