"""Analytics FastAPI Router — Section 5.4 / Phase 3.7.

Exposes eight endpoints under the ``/api/analytics`` prefix (mounted in main.py):

    GET  /overview
    GET  /financial
    GET  /operational
    GET  /risk
    GET  /projections
    GET  /corporate
    POST /ai-narrative
    GET  /export/pdf

All endpoints require the ``executive`` Firebase custom claim.
The ``require_executive_role`` dependency returns HTTP 403 for any
authenticated user without that claim.

Set ``ANALYTICS_SKIP_AUTH=true`` in the environment to bypass auth
during local development (dependencies.py handles this).
"""
from __future__ import annotations

import os
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.core.dependencies import require_executive_role
from app.modules.analytics import service as svc
from app.modules.analytics.export import generate_export_pdf
from app.modules.analytics.schemas import (
    AiNarrativeRequest,
    AiNarrativeResponse,
    CorporateResponse,
    ExportRequest,
    FinancialResponse,
    OperationalResponse,
    OverviewResponse,
    ProjectionsResponse,
    RiskResponse,
)

router = APIRouter()

_SKIP_AUTH = os.getenv("ANALYTICS_SKIP_AUTH", "false").lower() == "true"

# When ANALYTICS_SKIP_AUTH is active we still need a dependency signature
# that FastAPI accepts — use a no-op dependency.
if _SKIP_AUTH:
    async def _auth_dep() -> dict:
        return {"role": "executive", "uid": "dev-user"}
else:
    _auth_dep = require_executive_role  # type: ignore[assignment]

ExecutiveDep = Annotated[dict, Depends(_auth_dep)]

# ─────────────────────────────────────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/overview", response_model=OverviewResponse, tags=["Analytics — Core"])
async def get_overview(
    period: str = Query("mtd", description="Period token: mtd | qtd | ytd | last_30 | last_90 | last_12m | custom"),
    product: str = Query("all", description="Product filter: all | credit_card | mortgage"),
    date_from: Optional[str] = Query(None, description="ISO date for custom period start (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="ISO date for custom period end (YYYY-MM-DD)"),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Top-level executive summary for the period selector."""
    return svc.get_overview(
        period=period,
        product=product,
        user_role="executive",
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Financial
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/financial", response_model=FinancialResponse, tags=["Analytics — Core"])
async def get_financial(
    period: str = Query("ytd", description="Period token"),
    product: str = Query("all", description="Product filter"),
    breakdown: str = Query("monthly", description="Breakdown granularity: monthly | quarterly"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """P&L statement, margin analysis, and revenue trend."""
    return svc.get_financial(
        period=period,
        product=product,
        user_role="executive",
        breakdown=breakdown,
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Operational
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/operational", response_model=OperationalResponse, tags=["Analytics — Core"])
async def get_operational(
    period: str = Query("mtd", description="Period token"),
    product: str = Query("all", description="Product filter"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Originations, CC ops, mortgage pipeline, and CX quality KPIs."""
    return svc.get_operational(
        period=period,
        product=product,
        user_role="executive",
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Risk
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/risk", response_model=RiskResponse, tags=["Analytics — Core"])
async def get_risk(
    period: str = Query("mtd", description="Period token"),
    product: str = Query("all", description="Product filter"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Portfolio quality, NPL, vintage curves, concentration, and stress indicators."""
    return svc.get_risk(
        period=period,
        product=product,
        user_role="executive",
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Projections
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/projections", response_model=ProjectionsResponse, tags=["Analytics — Core"])
async def get_projections(
    horizon: str = Query("12m", description="Projection horizon: 12m | 24m"),
    product: str = Query("all", description="Product filter"),
    scenario: str = Query("base", description="Macro scenario: base | stress | upside"),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Monte Carlo revenue, originations, and NPL projections with p10/p50/p90 bands."""
    if horizon not in ("12m", "24m"):
        raise HTTPException(status_code=422, detail="horizon must be '12m' or '24m'")
    if scenario not in ("base", "stress", "upside"):
        raise HTTPException(status_code=422, detail="scenario must be 'base', 'stress', or 'upside'")
    return svc.get_projections(
        horizon=horizon,
        product=product,
        scenario=scenario,
        user_role="executive",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Corporate
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/corporate", response_model=CorporateResponse, tags=["Analytics — Core"])
async def get_corporate(
    period: str = Query("ytd", description="Period token"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """People metrics, unit economics, customer base, regulatory capital, and NPS."""
    return svc.get_corporate(
        period=period,
        user_role="executive",
        date_from=date_from,
        date_to=date_to,
    )


# ─────────────────────────────────────────────────────────────────────────────
# AI Narrative
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/ai-narrative", response_model=AiNarrativeResponse, tags=["Analytics — AI"])
async def post_ai_narrative(
    body: AiNarrativeRequest,
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Generate a 3-bullet executive brief using Gemini 2.0 Flash."""
    return svc.get_ai_narrative(
        period=body.period,
        include_sections=list(body.include_sections),
        tone=body.tone,
        user_role="executive",
    )


# ─────────────────────────────────────────────────────────────────────────────
# PDF Export
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/export/pdf", tags=["Analytics — Export"])
async def export_pdf(
    period: str = Query("mtd"),
    product: str = Query("all"),
    sections: str = Query(
        "overview,financial,operational,risk,projections,corporate",
        description="Comma-separated section names",
    ),
    demo: bool = Query(False, description="Add SAMPLE DATA watermark"),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> StreamingResponse:
    """Generate a board-ready PDF snapshot of the current dashboard view."""
    requested = [s.strip() for s in sections.split(",") if s.strip()]
    valid_sections = {"overview", "financial", "operational", "risk", "projections", "corporate"}
    for s in requested:
        if s not in valid_sections:
            raise HTTPException(status_code=422, detail=f"Invalid section: {s}")

    sections_data: dict[str, dict] = {}
    for section in requested:
        try:
            if section == "overview":
                sections_data[section] = svc.get_overview(period=period, product=product)
            elif section == "financial":
                sections_data[section] = svc.get_financial(period=period, product=product)
            elif section == "operational":
                sections_data[section] = svc.get_operational(period=period, product=product)
            elif section == "risk":
                sections_data[section] = svc.get_risk(period=period, product=product)
            elif section == "projections":
                sections_data[section] = svc.get_projections()
            elif section == "corporate":
                sections_data[section] = svc.get_corporate(period=period)
        except Exception as exc:
            # Skip a failing section rather than fail the whole export
            sections_data[section] = {"error": str(exc)}

    from datetime import datetime, timezone
    data_as_of = datetime.now(tz=timezone.utc).isoformat()
    pdf_bytes = generate_export_pdf(
        sections_data=sections_data,
        period=period,
        product=product,
        is_demo=demo,
        data_as_of=data_as_of,
    )

    import io
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="agenthive-analytics-{period}-{product}.pdf"'
            ),
        },
    )
