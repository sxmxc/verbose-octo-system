from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class RegexTestRequest(BaseModel):
    pattern: str = Field(..., description="Regular expression pattern")
    test_string: str = Field(..., description="Sample text to evaluate")
    flags: List[str] = Field(default_factory=list, description="re module flags, e.g. IGNORECASE")


class RegexMatch(BaseModel):
    match: str
    start: int
    end: int
    groups: List[Optional[str]]
    groupdict: Dict[str, Optional[str]]


class RegexTestResponse(BaseModel):
    ok: bool
    pattern: str
    flags: List[str]
    matches: List[RegexMatch]
    error: Optional[str] = None

