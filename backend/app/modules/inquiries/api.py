"""FastAPI router for tenant inquiries.

Mounted at: /api/v1
Wired in:   app/main.py

Endpoints:
    POST /api/v1/tenant-inquiries — Public intake from the marketing signup form.

Auth:
    Public by design (the submitter has no account yet). Abuse is mitigated by
    input validation, length caps, and the fact that rows are write-only from
    this surface. Add Turnstile/reCAPTCHA here if spam becomes a problem.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database import get_db
from app.modules.inquiries.notifications import notify_new_inquiry
from app.modules.inquiries.sample_package import send_sample_package
from app.modules.inquiries.schemas import (
    SamplePackageRequest,
    TenantInquiryRequest,
    TenantInquiryResponse,
)
from app.modules.underwriting.schemas import ProblemDetail
from app.shared.db_models import TenantInquiry

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/tenant-inquiries",
    response_model=TenantInquiryResponse,
    status_code=201,
    summary="Submit a tenant interest inquiry",
    description=(
        "Public endpoint backing the marketing-site signup form. "
        "Persists the inquiry for the sales/foundry team to review and provision."
    ),
)
async def create_tenant_inquiry(
    request: Request,
    payload: TenantInquiryRequest,
    db: AsyncSession = Depends(get_db),
) -> TenantInquiryResponse | JSONResponse:
    try:
        inquiry = TenantInquiry(
            name=payload.name.strip(),
            email=str(payload.email).strip().lower(),
            company=payload.company.strip(),
            title=payload.title.strip() if payload.title else None,
            use_case=payload.use_case.strip(),
            volume=payload.volume or None,
            referral=payload.referral.strip() if payload.referral else None,
        )
        db.add(inquiry)
        await db.flush()

        logger.info(
            "Tenant inquiry received",
            extra={
                "inquiry_id": inquiry.id,
                "company": inquiry.company,
                "volume": inquiry.volume,
            },
        )
        await notify_new_inquiry(inquiry)
        return TenantInquiryResponse(id=inquiry.id)
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
        logger.exception("Unexpected error in /tenant-inquiries", extra={"error": str(exc)})
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


@router.post(
    "/sample-audit-package",
    response_model=TenantInquiryResponse,
    status_code=201,
    summary="Email a sample SR 11-7 audit package (gated download)",
    description=(
        "Public endpoint backing the /audit-package page. Persists the lead as a "
        "tenant inquiry (referral=audit-package-download), emails the prospect a "
        "sample Model Validation Report, and notifies the team."
    ),
)
async def sample_audit_package(
    request: Request,
    payload: SamplePackageRequest,
    db: AsyncSession = Depends(get_db),
) -> TenantInquiryResponse | JSONResponse:
    try:
        # Persist as a lead in the same pipeline as demo requests.
        inquiry = TenantInquiry(
            name=payload.name.strip(),
            email=str(payload.email).strip().lower(),
            company=payload.company.strip(),
            title=None,
            use_case="Requested the sample SR 11-7 audit package (gated download).",
            volume=None,
            referral="audit-package-download",
        )
        db.add(inquiry)
        await db.flush()

        logger.info(
            "Sample package requested",
            extra={"inquiry_id": inquiry.id, "company": inquiry.company},
        )

        sent = await send_sample_package(
            name=inquiry.name, email=inquiry.email, company=inquiry.company
        )
        await notify_new_inquiry(inquiry)

        detail = (
            "Sample audit package sent — check your inbox."
            if sent
            else "Request received — we'll email the sample shortly."
        )
        return TenantInquiryResponse(id=inquiry.id, detail=detail)
    except Exception as exc:
        logger.exception("Unexpected error in /sample-audit-package", extra={"error": str(exc)})
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
