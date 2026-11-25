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

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    TenantContext,
    optional_tenant,
    require_firebase_user,
    require_tenant,
)
from app.core.logging import get_logger
from app.database import get_db
from app.modules.underwriting.schemas import ProblemDetail
from app.shared.db_models import AuditLog, DecisionRecord, Tenant, TenantMembership

logger = get_logger(__name__)
router = APIRouter()


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
