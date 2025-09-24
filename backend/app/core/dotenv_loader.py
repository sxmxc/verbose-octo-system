"""Minimal dotenv parser for shell consumption.

The bootstrap helper reads `.env` files to pick up overrides. When
operators copy `.env.example` the file often includes values with spaces,
which `bash` rejects unless quoted. The parser below accepts the common
subset we use across the repository and surfaces helpful errors when a
line cannot be parsed.
"""
from __future__ import annotations

import json
import re
import shlex
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Iterable, Iterator, Tuple

_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_VAR_PATTERN = re.compile(r"(?<!\\)\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


class DotenvError(ValueError):
    """Raised when a .env file contains an invalid entry."""


def _strip_comment(value: str) -> str:
    """Remove inline comments from an unquoted value."""
    for index, char in enumerate(value):
        if char == "#" and (index == 0 or value[index - 1].isspace()):
            return value[:index].rstrip()
    return value.rstrip()


def _parse_line(raw_line: str, line_no: int) -> Tuple[str, str] | None:
    line = raw_line.strip()
    if not line or line.startswith("#"):
        return None
    if line.startswith("export "):
        line = line[len("export "):].lstrip()

    if "=" not in line:
        raise DotenvError(f"Line {line_no}: expected KEY=VALUE assignment")

    key_part, value_part = line.split("=", 1)
    key = key_part.strip()
    if not _NAME_PATTERN.match(key):
        raise DotenvError(f"Line {line_no}: invalid variable name '{key}'")

    value = value_part.strip()
    if not value:
        return key, ""
    if value[0] in {'"', "'"}:
        try:
            tokens = shlex.split(value, posix=True)
        except ValueError as exc:
            raise DotenvError(f"Line {line_no}: {exc}") from exc
        if len(tokens) > 1:
            comment = tokens[1]
            if comment != "#" and not comment.startswith("#"):
                raise DotenvError(
                    f"Line {line_no}: unexpected tokens after quoted value"
                )
        return key, tokens[0]

    cleaned = _strip_comment(value)
    return key, cleaned.strip()

def _resolve_interpolations(values: "OrderedDict[str, str]") -> "OrderedDict[str, str]":
    resolved: "OrderedDict[str, str]" = OrderedDict()
    stack: set[str] = set()

    def resolve(key: str) -> str:
        if key in resolved:
            return resolved[key]
        if key not in values:
            raise DotenvError(f"Undefined variable '{key}' referenced during interpolation")
        if key in stack:
            cycle = " -> ".join(list(stack) + [key])
            raise DotenvError(f"Circular interpolation reference detected: {cycle}")
        stack.add(key)
        raw_value = values[key]
        try:
            def replacer(match: re.Match[str]) -> str:
                ref = match.group(1)
                return resolve(ref)

            result = _VAR_PATTERN.sub(replacer, raw_value)
        finally:
            stack.discard(key)
        resolved_value = result.replace(r"\${", "${")
        resolved[key] = resolved_value
        return resolved_value

    for key in values:
        resolve(key)
    return resolved

def parse_env_file(path: Path | str) -> "OrderedDict[str, str]":
    """Parse a dotenv file and return an ordered mapping of assignments."""
    dotenv_path = Path(path)
    data: "OrderedDict[str, str]" = OrderedDict()
    with dotenv_path.open("r", encoding="utf-8") as handle:
        for line_no, raw_line in enumerate(handle, start=1):
            parsed = _parse_line(raw_line.rstrip("\r\n"), line_no)
            if parsed is None:
                continue
            key, value = parsed
            data[key] = value
    return _resolve_interpolations(data)


def _format_exports(items: Iterable[Tuple[str, str]]) -> Iterator[str]:
    for key, value in items:
        yield f"export {key}={json.dumps(value)}"


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    env_path = Path(args[0]) if args else Path(".env")
    try:
        data = parse_env_file(env_path)
    except FileNotFoundError:
        return 0
    except DotenvError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    for line in _format_exports(data.items()):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
