from __future__ import annotations

"""Utilities for validating and normalising toolkit slugs."""

_ALLOWED_SLUG_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz0123456789-_")
_INVALID_SLUG_MESSAGE = "Toolkit slug must contain only lowercase letters, numbers, hyphen, or underscore"


class InvalidToolkitSlugError(ValueError):
    """Raised when a toolkit slug fails validation."""

def _check_slug(slug: str) -> None:
    if not slug:
        raise InvalidToolkitSlugError("Toolkit slug must not be empty")
    if any(ch not in _ALLOWED_SLUG_CHARS for ch in slug):
        raise InvalidToolkitSlugError(_INVALID_SLUG_MESSAGE)


def normalise_slug(raw: str) -> str:
    """Return a lowercase, trimmed slug after validation."""

    if raw is None:
        raise InvalidToolkitSlugError("Toolkit slug is required")
    slug = raw.strip().lower()
    _check_slug(slug)
    return slug


def validate_slug(slug: str) -> None:
    """Validate a slug without altering it."""

    if slug is None:
        raise InvalidToolkitSlugError("Toolkit slug is required")
    _check_slug(slug)


__all__ = [
    "InvalidToolkitSlugError",
    "normalise_slug",
    "validate_slug",
]
