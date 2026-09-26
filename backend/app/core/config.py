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
        default=(
            "http://localhost:9002,"
            "http://localhost:3000,"
            "http://127.0.0.1:3000,"
            "http://127.0.0.1:9002,"
            "https://agenthivehq.com,"
            "https://www.agenthivehq.com,"
            "https://agenthivehq-landing.firebaseapp.com,"
            "https://agenthivehq-landing.web.app,"
            "https://studio--agenthivehq-landing.us-central1.hosted.app"
        ),
        description="Comma-separated list of allowed CORS origins",
    )

    # ── AI / LLM keys ─────────────────────────────────────────────────────────
    # Gemini is tried first; OpenAI is the fallback; mock if both are absent.
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key (gemini-2.0-flash). Get one at https://aistudio.google.com/app/apikey")
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key (gpt-4o-mini); fallback when GEMINI_API_KEY is unset")

    # ── Cloudflare DNS ────────────────────────────────────────────────────────
    CF_API_TOKEN: str = Field(
        default="",
        description="Cloudflare API Token with DNS:Edit + Zone:Read permissions. Create at https://dash.cloudflare.com/profile/api-tokens",
    )
    CF_ZONE_ID: str = Field(
        default="",
        description="Default Cloudflare Zone ID.  Find it on the zone Overview page (bottom-right).",
    )

    # ── Google Cloud / BigQuery (primary datasource) ───────────────────────────
    # Shared with credit-risk-platform — points at the Freddie Mac SFLLD dataset.
    GCP_PROJECT_ID: str = Field(default="ai-risk-workflow", description="GCP project that hosts the BigQuery datasets")
    BQ_DATASET: str = Field(default="freddie_mac_sflld", description="BigQuery dataset containing Freddie Mac SFLLD origination + performance tables")
    GCP_CREDENTIALS_PATH: str = Field(
        default="",
        description="Path to a GCP service-account JSON key file.  Leave blank to use ADC / Cloud Run identity.",
    )

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
