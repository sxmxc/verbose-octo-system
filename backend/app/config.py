from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from typing import List


class Settings(BaseSettings):
    app_name: str = "Zabbix Admin"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    log_level: str = "INFO"

    zbx_base_url: AnyHttpUrl | None = None
    zbx_token: str | None = None

    redis_url: str = "redis://localhost:6379/0"
    cors_origins: List[str] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
