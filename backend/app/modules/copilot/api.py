"""FastAPI router for the copilot module.

Mounted at: /api/copilot
Wired in:   app/main.py

Endpoints:
    POST /api/copilot/explain  — Generate natural-language decision narrative.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.dependencies import require_firebase_user
from app.core.logging import get_logger
from app.modules.copilot.service import CopilotService
from app.modules.underwriting.schemas import ProblemDetail

logger = get_logger(__name__)
router = APIRouter()
_service = CopilotService()


# ── Request / Response schemas ────────────────────────────────────────────────

class CopilotRequest(BaseModel):
    """Request body for /api/copilot/explain."""

    decision_response: dict[str, Any] = Field(
        ...,
        description="Full UnderwritingResponse object from POST /api/underwriting/decision",
    )
    applicant_context: Optional[str] = Field(
        default="",
        max_length=500,
        description="Optional free-text context about the applicant (e.g. 'Gig worker, 28yo')",
    )


class CopilotResponseSchema(BaseModel):
    """Response shape for the copilot narrative."""

    narrative: str = Field(..., description="3-sentence plain-English decision explanation")
    risk_flags: list[str] = Field(..., description="Up to 3 risk factors from the decision")
    recommendations: list[str] = Field(..., description="Up to 3 actionable improvement steps")
    plain_english_apr: str = Field(..., description="Human-readable monthly interest explanation")


# ── POST /explain ─────────────────────────────────────────────────────────────

@router.post(
    "/explain",
    response_model=CopilotResponseSchema,
    status_code=200,
    summary="Generate natural-language narrative for a credit decision",
    description=(
        "Accepts a full UnderwritingResponse and returns a plain-English narrative, "
        "risk flags, recommendations, and APR explanation. "
        "Uses OpenAI gpt-4o-mini when OPENAI_API_KEY is configured; "
        "otherwise returns a deterministic template-based response."
    ),
)
async def explain_decision(
    request: Request,
    payload: CopilotRequest,
    _user: dict = Depends(require_firebase_user),
) -> CopilotResponseSchema:
    try:
        result = await _service.explain(
            decision_response=payload.decision_response,
            applicant_context=payload.applicant_context or "",
        )
        return CopilotResponseSchema(**result.to_dict())
    except Exception as exc:
        logger.exception("Error in /copilot/explain", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/copilot",
                title="Copilot Service Error",
                status=500,
                detail="Failed to generate decision narrative. Please try again.",
                instance=str(request.url.path),
            ).model_dump(),
        )
