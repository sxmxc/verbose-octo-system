from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...config import AuthProviderBase


@dataclass
class AuthResult:
    user_external_id: str
    username: str
    email: Optional[str]
    display_name: Optional[str]
    provider_name: str
    attributes: Dict[str, Any]
    roles: list[str]


class AuthProvider(ABC):
    def __init__(self, config: AuthProviderBase) -> None:
        self.config = config

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def display_name(self) -> str:
        return self.config.effective_display_name

    @property
    def enabled(self) -> bool:
        return bool(getattr(self.config, "enabled", True))

    @property
    def default_roles(self) -> list[str]:
        return list(getattr(self.config, "default_roles", []) or [])

    def get_login_metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "type": getattr(self.config, "type", "unknown"),
        }

    @abstractmethod
    async def begin(self, request: Request) -> Dict[str, Any]:
        """Start the login flow. Return dict containing redirect info or prompts."""

    @abstractmethod
    async def complete(self, request: Request, session: AsyncSession) -> AuthResult:
        """Complete the login flow and return normalized auth result."""
