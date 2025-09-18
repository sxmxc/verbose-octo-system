"""Toolkit registry for SRE Toolbox components."""

from typing import Sequence


class ToolboxModule:
    """Metadata contract for toolbox toolkits."""

    slug: str
    name: str

    def routers(self) -> Sequence:
        raise NotImplementedError


__all__ = ["ToolboxModule"]
