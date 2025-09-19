from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class RoleDefinition:
    slug: str
    name: str
    description: str


ROLE_TOOLKIT_USER = "toolkit.user"
ROLE_TOOLKIT_CURATOR = "toolkit.curator"
ROLE_SYSTEM_ADMIN = "system.admin"

ROLE_DEFINITIONS: Dict[str, RoleDefinition] = {
    ROLE_TOOLKIT_USER: RoleDefinition(
        slug=ROLE_TOOLKIT_USER,
        name="Toolkit User",
        description="Access installed toolkits and run operations.",
    ),
    ROLE_TOOLKIT_CURATOR: RoleDefinition(
        slug=ROLE_TOOLKIT_CURATOR,
        name="Toolkit Curator",
        description="Enable and configure toolkits but cannot install or uninstall packages.",
    ),
    ROLE_SYSTEM_ADMIN: RoleDefinition(
        slug=ROLE_SYSTEM_ADMIN,
        name="System Administrator",
        description="Full administrative access including security and toolkit lifecycle.",
    ),
}

DEFAULT_ROLE_SLUGS = [ROLE_TOOLKIT_USER]


__all__ = [
    "ROLE_TOOLKIT_USER",
    "ROLE_TOOLKIT_CURATOR",
    "ROLE_SYSTEM_ADMIN",
    "ROLE_DEFINITIONS",
    "DEFAULT_ROLE_SLUGS",
]
