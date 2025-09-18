from __future__ import annotations

import re
from typing import Dict

from fastapi import APIRouter

from .models import RegexMatch, RegexTestRequest, RegexTestResponse


router = APIRouter()


_FLAG_MAP: Dict[str, int] = {
    "IGNORECASE": re.IGNORECASE,
    "MULTILINE": re.MULTILINE,
    "DOTALL": re.DOTALL,
    "UNICODE": re.UNICODE,
    "ASCII": re.ASCII,
    "VERBOSE": re.VERBOSE,
}


def _resolve_flags(names):
    flags_value = 0
    for name in names:
        upper = name.upper()
        if upper in _FLAG_MAP:
            flags_value |= _FLAG_MAP[upper]
    return flags_value


@router.post("/test", summary="Evaluate a regular expression", response_model=RegexTestResponse)
def test_regex(req: RegexTestRequest):
    flags_value = _resolve_flags(req.flags)
    try:
        compiled = re.compile(req.pattern, flags=flags_value)
        matches = []
        for match in compiled.finditer(req.test_string):
            matches.append(
                RegexMatch(
                    match=match.group(0),
                    start=match.start(),
                    end=match.end(),
                    groups=list(match.groups()) if match.groups() else [],
                    groupdict=match.groupdict() if match.groupdict() else {},
                )
            )
        return RegexTestResponse(
            ok=True,
            pattern=req.pattern,
            flags=req.flags,
            matches=matches,
        )
    except re.error as exc:
        return RegexTestResponse(
            ok=False,
            pattern=req.pattern,
            flags=req.flags,
            matches=[],
            error=str(exc),
        )

