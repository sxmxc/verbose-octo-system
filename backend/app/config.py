from pathlib import Path
from typing import List

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings


def default_cors_origins() -> List[str]:
    # Allow common local dev frontends by default; override via FRONTEND_BASE_URL or CORS_ORIGINS
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]


class Settings(BaseSettings):
    app_name: str = "SRE Toolbox"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    log_level: str = "INFO"

    zbx_base_url: AnyHttpUrl | None = None
    zbx_token: str | None = None

    redis_url: str = Field(default="redis://redis:6379/0")
    redis_prefix: str = Field(default="sretoolbox")
    frontend_base_url: AnyHttpUrl | None = Field(default=None)
    cors_origins: List[str] = Field(default_factory=default_cors_origins)
    toolkit_storage_dir: Path = Field(default=Path("./data/toolkits"))

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @model_validator(mode="after")
    def ensure_cors(cls, settings: "Settings") -> "Settings":
        if settings.frontend_base_url:
            frontend_origin = str(settings.frontend_base_url)
            if frontend_origin not in settings.cors_origins:
                settings.cors_origins.append(frontend_origin)
        return settings

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
