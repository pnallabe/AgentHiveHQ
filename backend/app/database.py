"""Async SQLAlchemy engine, session factory, and table bootstrap.

Uses ``aiosqlite`` for local development and ``asyncpg`` for PostgreSQL
in staging/production — the driver is inferred from the DATABASE_URL scheme.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
# ``check_same_thread=False`` is only relevant for SQLite; ignored by asyncpg.
_connect_args: dict = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",  # SQL logging in dev only
    connect_args=_connect_args,
    pool_pre_ping=True,  # Validate connections before use
)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base class for ORM models ─────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency (use in FastAPI route handlers via Depends) ────────────────────
async def get_db() -> AsyncSession:  # type: ignore[return]
    """Yield an async database session and guarantee cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Table bootstrap ───────────────────────────────────────────────────────────
async def create_tables() -> None:
    """Create all ORM-mapped tables (no-op if they already exist).

    For production use Alembic migrations instead.  This covers the SQLite
    local-dev case and test fixtures.
    """
    # Import models so SQLAlchemy registers them with Base.metadata.
    import app.shared.db_models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Tables synchronised", extra={"url": settings.DATABASE_URL})
