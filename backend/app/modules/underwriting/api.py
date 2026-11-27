"""FastAPI router for the underwriting module.

Mounted at: /api/underwriting
Wired in:   app/main.py

Endpoints:
    POST /api/underwriting/decision   — Run underwriting decision pipeline.
    GET  /api/underwriting/history    — Paginated decision history.

Auth:
    Both endpoints require a valid Firebase ID token supplied as
    ``Authorization: Bearer <token>``.  Use the ``require_firebase_user``
    dependency from ``app.core.dependencies``.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    TenantContext,
    optional_tenant,
    require_firebase_user,
    require_tenant_or_api_key,
)
from app.core.logging import get_logger
from app.database import get_db
from app.modules.underwriting.batch import run_batch
from app.modules.underwriting.schemas import (
    BatchDecisionResponse,
    DecisionSummary,
    PaginatedDecisions,
    ProblemDetail,
    UnderwritingRequest,
    UnderwritingResponse,
)
from app.modules.underwriting.service import UnderwritingService
from app.shared.db_models import DecisionRecord

logger = get_logger(__name__)
router = APIRouter()

_service = UnderwritingService()


# ── POST /decision ────────────────────────────────────────────────────────────

@router.post(
    "/decision",
    response_model=UnderwritingResponse,
    status_code=200,
    summary="Run underwriting decision pipeline",
    description=(
        "Accepts an applicant financial profile, runs the rules engine and "
        "(mock) ML model, persists the result, and returns a structured "
        "decision with SHAP explanations and audit metadata."
    ),
)
async def create_decision(
    request: Request,
    payload: UnderwritingRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_firebase_user),
    tenant: Optional[TenantContext] = Depends(optional_tenant),
) -> UnderwritingResponse:
    try:
        return await _service.decide(
            payload, db, tenant_id=tenant.tenant_id if tenant else None
        )
    except ValidationError as exc:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Unprocessable Entity",
                status=422,
                detail=str(exc),
                instance=str(request.url.path),
            ).model_dump(),
        )
    except Exception as exc:
        logger.exception("Unexpected error in /decision", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Internal Server Error",
                status=500,
                detail="An unexpected error occurred.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── POST /decision/batch (bulk CSV upload) ───────────────────────────────────

@router.post(
    "/decision/batch",
    response_model=BatchDecisionResponse,
    status_code=200,
    summary="Bulk decision a CSV of applications",
    description=(
        "Upload a CSV of applicant profiles; every row runs through the live "
        "decision pipeline (feature engineering → rules → model → persist) and is "
        "stored as a tenant-scoped DecisionRecord + AuditLog. The resulting records "
        "feed the governance dashboard and the one-click exam package. "
        "CSV columns: income, employment_length, housing_status, credit_score (optional), "
        "applicant_ref (optional)."
    ),
)
async def create_batch_decision(
    request: Request,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant_or_api_key),
) -> BatchDecisionResponse | JSONResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Invalid File",
                status=422,
                detail="Upload a .csv file.",
                instance=str(request.url.path),
            ).model_dump(),
        )
    try:
        csv_bytes = await file.read()
        result = await run_batch(
            csv_bytes,
            db,
            tenant_id=tenant.tenant_id,
        )
        return BatchDecisionResponse(
            total_rows=result.total_rows,
            processed=result.processed,
            approved=result.approved,
            rejected=result.rejected,
            reviewed=result.reviewed,
            failed=result.failed,
            approval_rate=result.approval_rate,
            elapsed_seconds=result.elapsed_seconds,
            errors=result.errors,
        )
    except Exception as exc:
        logger.exception("Unexpected error in /decision/batch", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Internal Server Error",
                status=500,
                detail="An unexpected error occurred during batch processing.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── POST /decision/demo (public, demo-mode only) ─────────────────────────────

@router.post(
    "/decision/demo",
    response_model=UnderwritingResponse,
    status_code=200,
    summary="Public demo decision (no auth)",
    description=(
        "Public sandbox endpoint for the marketing showcase. Forces "
        "demo_mode=True — only pre-computed demo scenarios are served, never "
        "live inference. No auth required. Records are persisted with "
        "demo_mode=True and no tenant."
    ),
)
async def create_demo_decision(
    request: Request,
    payload: UnderwritingRequest,
    db: AsyncSession = Depends(get_db),
) -> UnderwritingResponse:
    # Force demo mode regardless of what the caller sent — this endpoint must
    # never run live inference.
    payload = payload.model_copy(update={"demo_mode": True})
    try:
        return await _service.decide(payload, db, tenant_id=None)
    except ValidationError as exc:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Unprocessable Entity",
                status=422,
                detail=str(exc),
                instance=str(request.url.path),
            ).model_dump(),
        )
    except Exception as exc:
        logger.exception("Unexpected error in /decision/demo", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="Internal Server Error",
                status=500,
                detail="An unexpected error occurred.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── GET /history ──────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=PaginatedDecisions,
    summary="Paginated decision history",
)
async def get_history(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=10, ge=1, le=100, description="Records per page"),
    decision: Optional[str] = Query(default=None, description="Filter: approve | reject | review"),
    demo_mode: Optional[bool] = Query(default=None, description="Filter by demo mode flag"),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_firebase_user),
    tenant: Optional[TenantContext] = Depends(optional_tenant),
) -> PaginatedDecisions:
    stmt = select(DecisionRecord).order_by(DecisionRecord.created_at.desc())

    # ── Tenant scoping ──────────────────────────────────────────────────────
    # Tenant-linked users see only their tenant's records; unlinked/sandbox
    # users see only untenanted (sandbox) records. Never mix the two.
    if tenant is not None:
        stmt = stmt.where(DecisionRecord.tenant_id == tenant.tenant_id)
    else:
        stmt = stmt.where(DecisionRecord.tenant_id.is_(None))

    if decision:
        stmt = stmt.where(DecisionRecord.decision == decision)
    if demo_mode is not None:
        stmt = stmt.where(DecisionRecord.demo_mode == demo_mode)

    # Count total matching rows.
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination.
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    records = result.scalars().all()

    items = [
        DecisionSummary(
            decision_id=r.id,
            created_at=r.created_at,
            decision=r.decision,
            credit_limit=float(r.credit_limit) if r.credit_limit is not None else None,
            apr=float(r.apr) if r.apr is not None else None,
            risk_segment=r.risk_segment,
            reason_codes=r.reason_codes or [],
            demo_mode=r.demo_mode,
        )
        for r in records
    ]

    import math
    pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedDecisions(items=items, total=total, page=page, pages=pages)
