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

from app.core.dependencies import require_firebase_user
from app.core.logging import get_logger
from app.database import get_db
from app.modules.governance.service import GovernanceDashboardService
from app.modules.underwriting.schemas import ProblemDetail
from sqlalchemy.ext.asyncio import AsyncSession

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
        return await _service.get(db=db, period=period)
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
) -> dict[str, Any]:
    try:
        return await _service.bias_report(db=db)
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
