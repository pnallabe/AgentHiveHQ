"""Alembic environment — async SQLAlchemy setup.

Reads DATABASE_URL from environment (via app.core.config) so migrations
work against both SQLite (dev) and PostgreSQL (prod) without code changes.
"""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Alembic Config object for fileConfig calls.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all ORM models so Alembic can detect schema changes.
from app.core.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.shared.db_models  # noqa: F401, E402  — registers models with Base.metadata

target_metadata = Base.metadata

# Override sqlalchemy.url from the application settings.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generate SQL only)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create async engine and run migrations."""
    connect_args = {"check_same_thread": False} if settings.is_sqlite else {}
    connectable = create_async_engine(settings.DATABASE_URL, connect_args=connect_args, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
