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

    # ── Inquiry notifications (SMTP) ─────────────────────────────────────────
    # For Gmail: enable 2FA, then create an App Password at
    # https://myaccount.google.com/apppasswords and use it as SMTP_PASSWORD.
    SMTP_HOST: str = Field(default="", description="SMTP server host, e.g. smtp.gmail.com. Blank disables inquiry notifications.")
    SMTP_PORT: int = Field(default=587, description="587 for STARTTLS, 465 for SSL")
    SMTP_USERNAME: str = Field(default="", description="Sending mailbox / SMTP login")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password or app password")
    INQUIRY_NOTIFY_TO: str = Field(default="", description="Comma-separated recipients for new inquiry alerts; defaults to SMTP_USERNAME")

    # ── Outreach engine (governance-first prospecting) ───────────────────────
    # Master kill switch. When false the sequencer logs what it WOULD send and
    # persists messages as status="queued" without touching SMTP.
    OUTREACH_SEND_ENABLED: bool = Field(
        default=False,
        description="Master switch for live outreach sending. Default false = dry-run.",
    )
    OUTREACH_FROM_NAME: str = Field(
        default="Pradeep Nallabelli",
        description="Display name on outbound outreach mail",
    )
    OUTREACH_FROM_EMAIL: str = Field(
        default="",
        description="From address for outreach; defaults to SMTP_USERNAME when blank",
    )
    OUTREACH_DAILY_LIMIT: int = Field(
        default=20, ge=1, le=500,
        description="Max outreach emails per sequencer run-day (domain warmup cap)",
    )
    OUTREACH_ADMIN_KEY: str = Field(
        default="",
        description="Shared secret for /api/v1/outreach/admin/* endpoints (X-Outreach-Admin-Key header)",
    )
    OUTREACH_PUBLIC_BASE_URL: str = Field(
        default="https://agenthivehq-backend-api-311931689095.us-central1.run.app",
        description="Public base URL used in tracking pixels / unsubscribe links",
    )
    OUTREACH_BOOKING_URL: str = Field(
        default="https://agenthivehq.com/signup",
        description="CTA link used in outreach copy (book-a-demo / sample audit package)",
    )

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(
        default="dev-only-insecure-secret",
        description="Random secret for signing tokens (e.g. outreach unsubscribe links). Generate: python -c \"import secrets; print(secrets.token_hex(32))\"",
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
