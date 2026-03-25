"""FastAPI router for the underwriting module.

Mounted at: /api/underwriting
Wired in:   app/main.py

Endpoints:
    POST /api/underwriting/decision   — Run underwriting decision pipeline.
    GET  /api/underwriting/history    — Paginated decision history.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database import get_db
from app.modules.underwriting.schemas import (
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
) -> UnderwritingResponse:
    try:
        return await _service.decide(payload, db)
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
) -> PaginatedDecisions:
    stmt = select(DecisionRecord).order_by(DecisionRecord.created_at.desc())

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
