"""FastAPI router for the governance module.

Mounted at: /api/governance
Wired in:   app/main.py

Endpoints:
    GET /api/governance/dashboard     — Aggregated governance metrics.
    GET /api/governance/bias-report   — Adverse impact / four-fifths rule report.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from app.core.dependencies import (
    TenantContext,
    optional_tenant,
    require_firebase_user,
    require_tenant_or_api_key,
)
from app.core.logging import get_logger
from app.database import get_db
from app.modules.governance.exam_package import build_exam_package
from app.modules.governance.service import GovernanceDashboardService
from app.modules.underwriting.schemas import ProblemDetail
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.db_models import AuditLog, DecisionRecord

logger = get_logger(__name__)
router = APIRouter()
_service = GovernanceDashboardService()

_VALID_PERIODS = {"last_7_days", "last_30_days", "last_90_days", "all_time"}


@router.get(
    "/dashboard",
    summary="Governance metrics dashboard",
    description=(
        "Returns aggregated decisioning metrics for a given period. "
        "Demo records are excluded. Periods: last_7_days, last_30_days, last_90_days, all_time."
    ),
)
async def governance_dashboard(
    request: Request,
    period: str = Query(
        default="last_30_days",
        description="Time window for aggregation",
    ),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_firebase_user),
    tenant: Optional[TenantContext] = Depends(optional_tenant),
) -> dict[str, Any]:
    if period not in _VALID_PERIODS:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Invalid Period",
                status=422,
                detail=f"period must be one of: {', '.join(sorted(_VALID_PERIODS))}",
                instance=str(request.url.path),
            ).model_dump(),
        )

    try:
        return await _service.get(
            db=db,
            period=period,
            tenant_id=tenant.tenant_id if tenant else None,
        )
    except Exception as exc:
        logger.exception("Error in /governance/dashboard", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Governance Dashboard Error",
                status=500,
                detail="Failed to load governance metrics.",
                instance=str(request.url.path),
            ).model_dump(),
        )


@router.get(
    "/bias-report",
    summary="Adverse impact / four-fifths rule bias report",
    description=(
        "Computes approval rates per income band and calculates the adverse impact ratio. "
        "A ratio below 0.8 flags potential disparate impact. "
        "For internal model monitoring only."
    ),
)
async def bias_report(
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_firebase_user),
    tenant: Optional[TenantContext] = Depends(optional_tenant),
) -> dict[str, Any]:
    try:
        return await _service.bias_report(
            db=db, tenant_id=tenant.tenant_id if tenant else None
        )
    except Exception as exc:
        logger.exception("Error in /governance/bias-report", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Bias Report Error",
                status=500,
                detail="Failed to generate bias report.",
                instance=str(request.url.path),
            ).model_dump(),
        )

# ── GET /governance/exam-package ─────────────────────────────────────────────

@router.get(
    "/exam-package",
    response_model=None,
    summary="One-click SR 11-7 exam package (Model Validation Report)",
    description=(
        "Generates a self-contained Model Validation Report from live system data: "
        "model inventory, validation evidence (performance + fair-lending), and the "
        "immutable audit trail. Tenant-scoped by construction. This is the artifact "
        "an SR 11-7 validator or OCC/CFPB examiner receives."
    ),
)
async def exam_package(
    request: Request,
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant_or_api_key),
) -> dict[str, Any] | JSONResponse:
    try:
        tenant_id = tenant.tenant_id
        tenant_slug = tenant.slug
        exported_by = tenant.email or tenant.user_uid

        # Pull the tenant-scoped audit trail (same query as /tenants/me/audit-export).
        stmt = (
            select(AuditLog, DecisionRecord)
            .join(DecisionRecord, AuditLog.decision_id == DecisionRecord.id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        if tenant_id is not None:
            stmt = stmt.where(AuditLog.tenant_id == tenant_id)
        else:
            stmt = stmt.where(AuditLog.tenant_id.is_(None))
        rows = (await db.execute(stmt)).all()

        audit_records = [
            {
                "audit_id": log.id,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "event_type": log.event_type,
                "actor": log.actor,
                "decision_id": log.decision_id,
                "decision": rec.decision if rec else None,
                "model_version": rec.model_version if rec else None,
                "metadata": log.metadata_ or {},
            }
            for log, rec in rows
        ]

        return await build_exam_package(
            db,
            tenant_id=tenant_id,
            tenant_slug=tenant_slug,
            exported_by=exported_by,
            audit_records=audit_records,
        )
    except Exception as exc:
        logger.exception("Error in /governance/exam-package", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Exam Package Error",
                status=500,
                detail="Failed to generate exam package.",
                instance=str(request.url.path),
            ).model_dump(),
        )
