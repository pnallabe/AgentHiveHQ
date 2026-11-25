"""FastAPI router for tenant context and administration.

Mounted at: /api/v1
Wired in:   app/main.py

Endpoints:
    GET  /api/v1/me                       — Current user + resolved tenant context.
    GET  /api/v1/tenants/me/audit-export  — Tenant-scoped audit log export (JSON).

Auth:
    Both require a valid Firebase ID token. ``/me`` never 403s — it reports
    ``tenant: null`` for unlinked users so the frontend can route them to a
    "request access" state. ``/audit-export`` requires tenant membership.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    TENANT_ROLES,
    TenantContext,
    optional_tenant,
    require_firebase_user,
    require_tenant,
    require_tenant_role,
)
from app.core.logging import get_logger
from app.database import get_db
from app.modules.underwriting.schemas import ProblemDetail
from app.shared.db_models import (
    AuditLog,
    DecisionRecord,
    Tenant,
    TenantApiKey,
    TenantMembership,
)

logger = get_logger(__name__)
router = APIRouter()

#: Plan → monthly decision limit (mirrors the marketing pricing page).
PLAN_DECISION_LIMITS: dict[str, Optional[int]] = {
    "pilot":      1_000,
    "starter":    1_000,
    "growth":     20_000,
    "enterprise": None,  # unlimited
}


# ── Request schemas ───────────────────────────────────────────────────────────

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="underwriter")


class ChangeRoleRequest(BaseModel):
    role: str = Field(...)


def _member_payload(m: TenantMembership) -> dict[str, Any]:
    return {
        "id": m.id,
        "user_uid": m.user_uid,
        "email": m.email,
        "role": m.role,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── GET /me ───────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    summary="Current user and tenant context",
    description=(
        "Returns the authenticated user's identity plus their resolved tenant "
        "membership. ``tenant`` is null when the account is not linked to any "
        "active tenant — the frontend uses this to route to a request-access state."
    ),
)
async def get_me(
    claims: dict = Depends(require_firebase_user),
    tenant: Optional[TenantContext] = Depends(optional_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    tenant_payload: Optional[dict[str, Any]] = None
    if tenant is not None:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant.tenant_id))
        tenant_row = result.scalar_one_or_none()
        tenant_payload = {
            "id": tenant.tenant_id,
            "slug": tenant.slug,
            "display_name": tenant_row.display_name if tenant_row else tenant.slug,
            "plan": tenant_row.plan if tenant_row else "pilot",
            "role": tenant.role,
        }

    return {
        "user": {
            "uid": claims.get("uid"),
            "email": claims.get("email"),
            "role": claims.get("role"),  # platform-level claim, e.g. 'executive'
        },
        "tenant": tenant_payload,
    }


# ── GET /tenants/me/audit-export ─────────────────────────────────────────────

@router.get(
    "/tenants/me/audit-export",
    response_model=None,
    summary="Tenant-scoped audit log export",
    description=(
        "Exports the tenant's decision audit trail as JSON for examiner review "
        "or internal model-risk documentation. Tenant-scoped by construction — "
        "a member can only ever export their own tenant's records."
    ),
)
async def audit_export(
    request: Request,
    limit: int = Query(default=500, ge=1, le=5000),
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        stmt = (
            select(AuditLog, DecisionRecord)
            .join(DecisionRecord, AuditLog.decision_id == DecisionRecord.id)
            .where(AuditLog.tenant_id == tenant.tenant_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(stmt)).all()

        records = [
            {
                "audit_id": log.id,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "event_type": log.event_type,
                "actor": log.actor,
                "decision_id": log.decision_id,
                "decision": rec.decision if rec else None,
                "model_version": rec.model_version if rec else None,
                "demo_mode": rec.demo_mode if rec else None,
                "metadata": log.metadata_ or {},
            }
            for log, rec in rows
        ]

        logger.info(
            "Audit export generated",
            extra={"tenant": tenant.slug, "actor": tenant.user_uid, "count": len(records)},
        )
        return {
            "tenant_slug": tenant.slug,
            "exported_by": tenant.email or tenant.user_uid,
            "record_count": len(records),
            "records": records,
        }
    except Exception as exc:
        logger.exception("Error in /tenants/me/audit-export", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Audit Export Error",
                status=500,
                detail="Failed to generate audit export.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── GET /tenants/me/members ──────────────────────────────────────────────────

@router.get(
    "/tenants/me/members",
    summary="List tenant members",
)
async def list_members(
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(TenantMembership)
        .where(TenantMembership.tenant_id == tenant.tenant_id)
        .order_by(TenantMembership.created_at)
    )
    members = result.scalars().all()
    return {
        "tenant_slug": tenant.slug,
        "members": [_member_payload(m) for m in members],
        "caller_role": tenant.role,
    }


# ── POST /tenants/me/members ─────────────────────────────────────────────────

@router.post(
    "/tenants/me/members",
    status_code=201,
    summary="Invite / add a member (admin only)",
)
async def invite_member(
    request: Request,
    payload: InviteMemberRequest,
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    role = payload.role.strip().lower()
    if role not in TENANT_ROLES:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Invalid Role",
                status=422,
                detail=f"role must be one of: {', '.join(TENANT_ROLES)}",
                instance=str(request.url.path),
            ).model_dump(),
        )

    email = str(payload.email).strip().lower()

    # Resolve (or create) the Firebase user so the membership maps to a real UID.
    try:
        from app.core.firebase_admin import _get_firebase_app  # noqa: PLC0415
        from firebase_admin import auth as fb_auth  # noqa: PLC0415

        _get_firebase_app()
        try:
            user = await asyncio.to_thread(fb_auth.get_user_by_email, email)
            uid = user.uid
        except fb_auth.UserNotFoundError:
            user = await asyncio.to_thread(
                fb_auth.create_user, email=email, email_verified=False
            )
            uid = user.uid
        # Set tenant claims (merge with existing).
        existing = (await asyncio.to_thread(fb_auth.get_user, uid)).custom_claims or {}
        await asyncio.to_thread(
            fb_auth.set_custom_user_claims,
            uid,
            {**existing, "tenant_slug": tenant.slug, "tenant_role": role},
        )
    except Exception as exc:
        logger.warning("Firebase unavailable during invite; using email as uid: %s", exc)
        uid = email  # dev / no-firebase fallback

    # Upsert membership.
    result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.tenant_id,
            TenantMembership.user_uid == uid,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        membership = TenantMembership(
            tenant_id=tenant.tenant_id, user_uid=uid, email=email, role=role
        )
        db.add(membership)
        await db.flush()
    else:
        membership.role = role
        membership.email = email

    logger.info(
        "Member invited",
        extra={"tenant": tenant.slug, "email": email, "role": role, "by": tenant.user_uid},
    )
    return {"member": _member_payload(membership), "created": True}


# ── PATCH /tenants/me/members/{member_id} ────────────────────────────────────

@router.patch(
    "/tenants/me/members/{member_id}",
    summary="Change a member's role (admin only)",
)
async def change_member_role(
    request: Request,
    member_id: str,
    payload: ChangeRoleRequest,
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    role = payload.role.strip().lower()
    if role not in TENANT_ROLES:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Invalid Role",
                status=422,
                detail=f"role must be one of: {', '.join(TENANT_ROLES)}",
                instance=str(request.url.path),
            ).model_dump(),
        )

    result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.id == member_id,
            TenantMembership.tenant_id == tenant.tenant_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        return JSONResponse(
            status_code=404,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/not-found",
                title="Member Not Found",
                status=404,
                detail="No member with that ID in your tenant.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    membership.role = role
    logger.info(
        "Member role changed",
        extra={"tenant": tenant.slug, "member_id": member_id, "role": role, "by": tenant.user_uid},
    )
    return {"member": _member_payload(membership)}


# ── DELETE /tenants/me/members/{member_id} ───────────────────────────────────

@router.delete(
    "/tenants/me/members/{member_id}",
    summary="Revoke a member (admin only)",
)
async def revoke_member(
    request: Request,
    member_id: str,
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.id == member_id,
            TenantMembership.tenant_id == tenant.tenant_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        return JSONResponse(
            status_code=404,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/not-found",
                title="Member Not Found",
                status=404,
                detail="No member with that ID in your tenant.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    # Prevent an admin from revoking their own membership (lockout guard).
    if membership.user_uid == tenant.user_uid:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Cannot Revoke Self",
                status=422,
                detail="You cannot revoke your own membership. Ask another admin.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    await db.delete(membership)
    logger.info(
        "Member revoked",
        extra={"tenant": tenant.slug, "member_id": member_id, "by": tenant.user_uid},
    )
    return {"revoked": True, "member_id": member_id}


# ── GET /tenants/me/usage ────────────────────────────────────────────────────

@router.get(
    "/tenants/me/usage",
    summary="Current-period usage vs plan limit",
)
async def get_usage(
    tenant: TenantContext = Depends(require_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    from datetime import datetime, timezone  # noqa: PLC0415

    now = datetime.now(tz=timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    count_stmt = (
        select(func.count())
        .select_from(DecisionRecord)
        .where(
            DecisionRecord.tenant_id == tenant.tenant_id,
            DecisionRecord.created_at >= period_start,
        )
    )
    used: int = (await db.execute(count_stmt)).scalar_one() or 0

    result = await db.execute(select(Tenant).where(Tenant.id == tenant.tenant_id))
    tenant_row = result.scalar_one_or_none()
    plan = tenant_row.plan if tenant_row else "pilot"
    limit = PLAN_DECISION_LIMITS.get(plan)

    return {
        "tenant_slug": tenant.slug,
        "plan": plan,
        "period_start": period_start.isoformat(),
        "decisions_used": used,
        "decisions_limit": limit,
        "unlimited": limit is None,
        "utilization_pct": round(used / limit * 100, 1) if limit else None,
    }


# ── API keys ──────────────────────────────────────────────────────────────────

#: Scopes a key may be granted. Keep in sync with endpoint enforcement.
API_KEY_SCOPES = ("decisions:write", "decisions:read", "governance:read")


class CreateApiKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    scopes: list[str] = Field(default_factory=lambda: ["decisions:write"])


def _key_payload(k: TenantApiKey) -> dict[str, Any]:
    return {
        "id": k.id,
        "name": k.name,
        "key_prefix": k.key_prefix,
        "scopes": k.scopes,
        "created_by": k.created_by,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "revoked": k.revoked_at is not None,
    }


@router.get(
    "/tenants/me/api-keys",
    summary="List API keys (admin only)",
)
async def list_api_keys(
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(
        select(TenantApiKey)
        .where(TenantApiKey.tenant_id == tenant.tenant_id)
        .order_by(TenantApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return {"tenant_slug": tenant.slug, "api_keys": [_key_payload(k) for k in keys]}


@router.post(
    "/tenants/me/api-keys",
    status_code=201,
    summary="Create an API key (admin only)",
    description=(
        "Returns the plaintext key exactly once — store it securely. "
        "Only the SHA-256 hash is persisted."
    ),
)
async def create_api_key(
    request: Request,
    payload: CreateApiKeyRequest,
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from app.modules.tenants.api_keys import generate_api_key  # noqa: PLC0415

    invalid = [s for s in payload.scopes if s not in API_KEY_SCOPES]
    if invalid:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Invalid Scope",
                status=422,
                detail=(
                    f"Unknown scope(s): {', '.join(invalid)}. "
                    f"Allowed: {', '.join(API_KEY_SCOPES)}"
                ),
                instance=str(request.url.path),
            ).model_dump(),
        )

    generated = generate_api_key()
    key = TenantApiKey(
        tenant_id=tenant.tenant_id,
        name=payload.name.strip(),
        key_prefix=generated.prefix,
        key_hash=generated.key_hash,
        scopes=payload.scopes,
        created_by=tenant.user_uid,
    )
    db.add(key)
    await db.flush()

    logger.info(
        "API key created",
        extra={"tenant": tenant.slug, "key_id": key.id, "by": tenant.user_uid},
    )
    return {
        "api_key": _key_payload(key),
        "plaintext_key": generated.plaintext,
        "notice": "Store this key securely — it is shown only once.",
    }


@router.delete(
    "/tenants/me/api-keys/{key_id}",
    summary="Revoke an API key (admin only)",
)
async def revoke_api_key(
    request: Request,
    key_id: str,
    tenant: TenantContext = Depends(require_tenant_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Any:
    from datetime import datetime, timezone  # noqa: PLC0415

    result = await db.execute(
        select(TenantApiKey).where(
            TenantApiKey.id == key_id,
            TenantApiKey.tenant_id == tenant.tenant_id,
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        return JSONResponse(
            status_code=404,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/not-found",
                title="Key Not Found",
                status=404,
                detail="No API key with that ID in your tenant.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    if key.revoked_at is None:
        key.revoked_at = datetime.now(tz=timezone.utc)
    logger.info(
        "API key revoked",
        extra={"tenant": tenant.slug, "key_id": key_id, "by": tenant.user_uid},
    )
    return {"revoked": True, "key_id": key_id}
