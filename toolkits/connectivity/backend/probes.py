from __future__ import annotations

import hashlib
from typing import Iterable, List

from .models import ConnectivitySummary, ProbeEndpoint, ProbePort, ProbeResult


_FAILURE_MESSAGES = [
    "Connection timed out",
    "TCP handshake failed",
    "Host unreachable",
    "Port filtered by firewall",
]


def _simulate_single(host: str, port: ProbePort, attempt: int) -> ProbeResult:
    key = f"{host}:{port.port}/{port.protocol}:{attempt}".encode()
    digest = hashlib.sha256(key).digest()
    score = digest[0]
    reachable = (score % 5) != 0
    latency = 8 + (digest[1] / 255) * 120
    message = None
    if not reachable:
        message = _FAILURE_MESSAGES[score % len(_FAILURE_MESSAGES)]
    return ProbeResult(
        host=host,
        port=port.port,
        protocol=port.protocol,
        status="reachable" if reachable else "unreachable",
        latency_ms=round(latency, 2),
        message=message,
        attempt=attempt,
    )


def simulate_connectivity(endpoints: Iterable[ProbeEndpoint], repetitions: int = 1) -> ConnectivitySummary:
    repetitions = max(1, int(repetitions))
    results: List[ProbeResult] = []
    for attempt in range(1, repetitions + 1):
        for endpoint in endpoints:
            ports = endpoint.ports or [ProbePort(port=80)]
            for port in ports:
                results.append(_simulate_single(endpoint.host, port, attempt))

    failures = sum(1 for result in results if result.status == "unreachable")
    return ConnectivitySummary(
        ok=failures == 0,
        total_probes=len(results),
        failures=failures,
        results=results,
        repetitions=repetitions,
    )
