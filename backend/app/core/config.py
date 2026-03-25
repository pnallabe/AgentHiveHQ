"""AgentHive backend configuration.

All settings are read from environment variables (or a .env file).
No production secrets are ever hard-coded here.
"""
from __future__ import annotations

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration via Pydantic BaseSettings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_ENV: str = Field(default="development", description="Runtime environment: development | staging | production")
    APP_PORT: int = Field(default=8000, ge=1, le=65535)
    APP_LOG_LEVEL: str = Field(default="INFO", description="Python logging level")

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./agenthive.db",
        description="SQLAlchemy async connection string",
    )

    # ── CORS ────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:9002,http://localhost:3000",
        description="Comma-separated list of allowed CORS origins",
    )

    # ── External services ────────────────────────────────────────────────────
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key; empty → graceful mock fallback")

    @field_validator("APP_ENV")
    @classmethod
    def validate_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}, got '{v}'")
        return v

    @field_validator("APP_LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        v = v.upper()
        if v not in allowed:
            raise ValueError(f"APP_LOG_LEVEL must be one of {allowed}")
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        """Return ALLOWED_ORIGINS as a Python list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


# Singleton — import this everywhere you need config.
settings = Settings()
