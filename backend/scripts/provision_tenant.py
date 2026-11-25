"""Provision a new tenant and link a Firebase user as its first admin.

Usage
-----
    # Provision tenant + admin (sets Firebase custom claims):
    python -m scripts.provision_tenant \
        --slug acme-cu --name "Acme Credit Union" \
        --admin-email jane@acmecu.org --plan pilot

    # Add another member to an existing tenant:
    python -m scripts.provision_tenant \
        --slug acme-cu --add-member bob@acmecu.org --role risk_manager

    # List tenants:
    python -m scripts.provision_tenant --list

    # Dry run (no DB writes, no Firebase calls):
    python -m scripts.provision_tenant --slug acme-cu --name "Acme CU" \
        --admin-email jane@acmecu.org --dry-run

Notes
-----
- The Firebase user is looked up (or created) by email. Custom claims
  ``tenant_slug`` and ``tenant_role`` are set; the user must sign out and
  back in for the new claims to appear in their ID token.
- Requires Firebase Admin credentials (GOOGLE_APPLICATION_CREDENTIALS or ADC)
  unless ``--no-firebase`` is passed (DB-only mode, useful for local dev with
  ANALYTICS_SKIP_AUTH=true).
- Idempotent: re-running with the same slug updates the tenant and ensures
  the membership exists rather than failing.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import re
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import TENANT_ROLES
from app.core.logging import configure_logging
from app.database import AsyncSessionLocal, create_tables
from app.shared.db_models import Tenant, TenantMembership

logger = logging.getLogger("provision_tenant")

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")
_VALID_PLANS = ("pilot", "starter", "growth", "enterprise")


# ── Firebase helpers ──────────────────────────────────────────────────────────

def _firebase_get_or_create_user(email: str) -> str:
    """Return the Firebase UID for ``email``, creating the user if needed."""
    from app.core.firebase_admin import _get_firebase_app  # noqa: PLC0415
    from firebase_admin import auth  # noqa: PLC0415

    _get_firebase_app()
    try:
        user = auth.get_user_by_email(email)
        logger.info("Firebase user found", extra={"email": email, "uid": user.uid})
        return user.uid
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, email_verified=False)
        logger.info("Firebase user created", extra={"email": email, "uid": user.uid})
        return user.uid


def _firebase_set_tenant_claims(uid: str, slug: str, role: str) -> None:
    """Set tenant claims, preserving any existing claims (e.g. role=executive)."""
    from app.core.firebase_admin import _get_firebase_app  # noqa: PLC0415
    from firebase_admin import auth  # noqa: PLC0415

    _get_firebase_app()
    existing = auth.get_user(uid).custom_claims or {}
    merged = {**existing, "tenant_slug": slug, "tenant_role": role}
    auth.set_custom_user_claims(uid, merged)
    logger.info(
        "Firebase custom claims set",
        extra={"uid": uid, "tenant_slug": slug, "tenant_role": role},
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _upsert_tenant(
    db: AsyncSession, *, slug: str, name: str, plan: str
) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(slug=slug, display_name=name, plan=plan, status="active")
        db.add(tenant)
        await db.flush()
        logger.info("Tenant created", extra={"slug": slug, "plan": plan})
    else:
        tenant.display_name = name
        tenant.plan = plan
        if tenant.status != "active":
            tenant.status = "active"
            logger.info("Tenant reactivated", extra={"slug": slug})
        logger.info("Tenant updated", extra={"slug": slug, "plan": plan})
    return tenant


async def _ensure_membership(
    db: AsyncSession, *, tenant: Tenant, uid: str, email: str, role: str
) -> TenantMembership:
    result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_uid == uid,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        membership = TenantMembership(
            tenant_id=tenant.id, user_uid=uid, email=email, role=role
        )
        db.add(membership)
        await db.flush()
        logger.info(
            "Membership created",
            extra={"tenant": tenant.slug, "uid": uid, "role": role},
        )
    else:
        membership.role = role
        membership.email = email
        logger.info(
            "Membership updated",
            extra={"tenant": tenant.slug, "uid": uid, "role": role},
        )
    return membership


async def _list_tenants(db: AsyncSession) -> None:
    result = await db.execute(select(Tenant).order_by(Tenant.created_at))
    tenants = result.scalars().all()
    if not tenants:
        print("No tenants provisioned yet.")
        return
    print(f"{'SLUG':<24} {'NAME':<32} {'PLAN':<12} {'STATUS':<10} MEMBERS")
    print("-" * 90)
    for t in tenants:
        mresult = await db.execute(
            select(TenantMembership).where(TenantMembership.tenant_id == t.id)
        )
        members = mresult.scalars().all()
        print(f"{t.slug:<24} {t.display_name:<32} {t.plan:<12} {t.status:<10} {len(members)}")
        for m in members:
            print(f"  └─ {m.email or m.user_uid:<40} role={m.role}")


# ── Main ──────────────────────────────────────────────────────────────────────

async def _run(args: argparse.Namespace) -> int:
    await create_tables()

    async with AsyncSessionLocal() as db:
        if args.list:
            await _list_tenants(db)
            return 0

        slug = args.slug
        if not slug or not _SLUG_RE.match(slug):
            print(
                f"ERROR: --slug '{slug}' must be 3-64 chars, lowercase "
                "alphanumeric with hyphens, e.g. 'acme-cu'.",
                file=sys.stderr,
            )
            return 2

        # ── Add-member mode ──────────────────────────────────────────────
        if args.add_member:
            result = await db.execute(select(Tenant).where(Tenant.slug == slug))
            tenant = result.scalar_one_or_none()
            if tenant is None:
                print(f"ERROR: tenant '{slug}' does not exist.", file=sys.stderr)
                return 1

            email = args.add_member.strip().lower()
            if args.dry_run:
                print(f"[dry-run] would add {email} to {slug} as {args.role}")
                return 0

            uid = email  # DB-only fallback when Firebase is disabled
            if not args.no_firebase:
                uid = await asyncio.to_thread(_firebase_get_or_create_user, email)
                await asyncio.to_thread(
                    _firebase_set_tenant_claims, uid, slug, args.role
                )
            await _ensure_membership(
                db, tenant=tenant, uid=uid, email=email, role=args.role
            )
            await db.commit()
            print(f"OK: {email} added to '{slug}' as {args.role}.")
            if not args.no_firebase:
                print("NOTE: user must sign out and back in for claims to take effect.")
            return 0

        # ── Provision mode ───────────────────────────────────────────────
        if not args.name or not args.admin_email:
            print(
                "ERROR: --name and --admin-email are required when provisioning.",
                file=sys.stderr,
            )
            return 2

        email = args.admin_email.strip().lower()
        if args.dry_run:
            print(
                f"[dry-run] would provision tenant slug={slug} name='{args.name}' "
                f"plan={args.plan} with admin {email}"
            )
            return 0

        uid = email
        if not args.no_firebase:
            uid = await asyncio.to_thread(_firebase_get_or_create_user, email)

        tenant = await _upsert_tenant(db, slug=slug, name=args.name, plan=args.plan)
        await _ensure_membership(
            db, tenant=tenant, uid=uid, email=email, role="admin"
        )
        await db.commit()

        if not args.no_firebase:
            await asyncio.to_thread(_firebase_set_tenant_claims, uid, slug, "admin")

        print(f"OK: tenant '{slug}' provisioned (plan={args.plan}).")
        print(f"    admin: {email} (uid={uid})")
        if not args.no_firebase:
            print("NOTE: admin must sign out and back in for claims to take effect.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Provision AgentHive tenants and memberships.",
    )
    parser.add_argument("--slug", help="URL-safe tenant slug, e.g. 'acme-cu'")
    parser.add_argument("--name", help="Tenant display name")
    parser.add_argument(
        "--plan",
        default="pilot",
        choices=_VALID_PLANS,
        help="Subscription plan (default: pilot)",
    )
    parser.add_argument("--admin-email", help="Email of the first tenant admin")
    parser.add_argument(
        "--add-member",
        metavar="EMAIL",
        help="Add a member to an existing tenant (requires --slug)",
    )
    parser.add_argument(
        "--role",
        default="underwriter",
        choices=TENANT_ROLES,
        help="Role for --add-member (default: underwriter)",
    )
    parser.add_argument("--list", action="store_true", help="List all tenants")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without writing anything",
    )
    parser.add_argument(
        "--no-firebase",
        action="store_true",
        help="DB-only mode — skip Firebase user creation/claims (local dev)",
    )
    args = parser.parse_args()

    configure_logging("INFO")
    try:
        code = asyncio.run(_run(args))
    except KeyboardInterrupt:
        code = 130
    sys.exit(code)


if __name__ == "__main__":
    main()
