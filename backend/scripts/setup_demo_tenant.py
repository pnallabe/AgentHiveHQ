"""One-off: provision the 'Meridian Financial' demo tenant + API key.

Creates a tenant (slug=meridian-financial) and a programmatic API key so the
100k-application demo can run against production with tenant-scoped data.

Run against production by pointing DATABASE_URL at the Cloud SQL instance
(via the Cloud SQL Auth Proxy or the mounted socket on Cloud Run):

    DATABASE_URL="postgresql+asyncpg://..." \
        python -m backend.scripts.setup_demo_tenant

Prints the plaintext API key exactly once — store it in Secret Manager.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import os

DATABASE_URL = os.environ["DATABASE_URL"]

DEMO_SLUG = "meridian-financial"
DEMO_NAME = "Meridian Financial (Demo)"


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        from app.modules.tenants.api_keys import generate_api_key
        from app.shared.db_models import Tenant, TenantApiKey

        # ── Tenant ──────────────────────────────────────────────────────────
        existing = (
            await db.execute(select(Tenant).where(Tenant.slug == DEMO_SLUG))
        ).scalar_one_or_none()

        if existing:
            tenant = existing
            print(f"Tenant already exists: {tenant.slug} (id={tenant.id})", file=sys.stderr)
        else:
            tenant = Tenant(slug=DEMO_SLUG, display_name=DEMO_NAME, plan="growth", status="active")
            db.add(tenant)
            await db.flush()
            print(f"Created tenant: {tenant.slug} (id={tenant.id})", file=sys.stderr)

        # ── API key ─────────────────────────────────────────────────────────
        generated = generate_api_key()
        key = TenantApiKey(
            tenant_id=tenant.id,
            name="demo-100k-batch",
            key_prefix=generated.prefix,
            key_hash=generated.key_hash,
            scopes=["decisions:write", "governance:read"],
            created_by="setup_demo_tenant.py",
        )
        db.add(key)
        await db.commit()

        print("\n=== DEMO TENANT PROVISIONED ===")
        print(f"tenant_slug : {tenant.slug}")
        print(f"tenant_id   : {tenant.id}")
        print(f"key_prefix  : {generated.prefix}")
        print(f"API KEY (store now, shown once):\n{generated.plaintext}\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
