from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class VaultSecretRef(BaseModel):
    """Reference to a secret stored in HashiCorp Vault."""

    mount: Optional[str] = Field(default=None, description="Vault mount point (defaults to settings.vault_kv_mount)")
    path: str = Field(..., description="Secret path under the mount (without data/ prefix)")
    key: str = Field(..., description="Key within the secret payload to read")
    engine: Literal["kv-v2", "kv-v1"] = Field(default="kv-v2", description="Secrets engine type")
    version: Optional[int] = Field(default=None, description="Secret version (kv-v2 only)")

    model_config = {
        "extra": "forbid",
    }
