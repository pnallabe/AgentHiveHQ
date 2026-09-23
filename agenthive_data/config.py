"""
Configuration module for agenthive_data.
Manages storage paths, database connections, environment flags, and multi-tenant defaults.
"""

from pathlib import Path
import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DataConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Environment & Multi-Tenancy
    ENV: str = Field(default="development", description="Environment mode: development, staging, production")
    DEFAULT_TENANT_ID: str = Field(default="tenant_default", description="Default tenant identifier")
    
    # Base Storage Directories
    BASE_DATA_DIR: Path = Field(
        default_factory=lambda: Path(os.getenv("AGANTHIVE_DATA_DIR", Path(__file__).resolve().parent / "data_store")),
        description="Root directory for local data persistence"
    )
    
    @property
    def BRONZE_DIR(self) -> Path:
        p = self.BASE_DATA_DIR / "medallion" / "bronze"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def SILVER_DIR(self) -> Path:
        p = self.BASE_DATA_DIR / "medallion" / "silver"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def GOLD_DIR(self) -> Path:
        p = self.BASE_DATA_DIR / "medallion" / "gold"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def PARQUET_STORE_DIR(self) -> Path:
        p = self.BASE_DATA_DIR / "parquet"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def DUCKDB_PATH(self) -> Path:
        p = self.BASE_DATA_DIR / "warehouse.duckdb"
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def SQLITE_PATH(self) -> Path:
        p = self.BASE_DATA_DIR / "operational.db"
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    # External APIs
    FRED_API_KEY: str = Field(default="", description="St. Louis FRED API Key")
    SEC_EDGAR_USER_AGENT: str = Field(
        default="AgentHive-RiskEngine admin@agenthive.com", 
        description="User-agent header required by SEC EDGAR API"
    )

    # Cache & Feature Store Config
    FEATURE_STORE_CACHE_TTL_SECONDS: int = Field(default=3600, description="In-memory cache TTL for features")
    MAX_ONLINE_CACHE_SIZE: int = Field(default=10000, description="Max entities in memory feature cache")


config = DataConfig()
