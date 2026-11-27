"""Pydantic v2 request/response schemas for the underwriting module.

These schemas define the API contract documented in CODING_PROMPT.md §4.5.
They are the single source of truth for both validation and OpenAPI docs.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Request ───────────────────────────────────────────────────────────────────

class UnderwritingRequest(BaseModel):
    """Applicant profile submitted for underwriting decision."""

    income: float = Field(
        ...,
        gt=0,
        le=999_999,
        description="Annual gross income in USD",
        examples=[75_000],
    )
    employment_length: float = Field(
        ...,
        ge=0,
        le=50,
        description="Continuous years of current employment",
        examples=[3.0],
    )
    housing_status: Literal["own", "mortgage", "rent"] = Field(
        ...,
        description="Primary housing arrangement",
        examples=["mortgage"],
    )
    credit_score: Optional[int] = Field(
        default=None,
        ge=300,
        le=850,
        description="FICO/VantageScore credit score; omit for thin-file applicants",
        examples=[720],
    )
    scenario_tag: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Pre-defined demo scenario key (used with demo_mode=true only)",
        examples=["prime_applicant"],
    )
    demo_mode: bool = Field(
        default=False,
        description="When true, returns pre-computed demo responses; still writes to DB",
    )


# ── Nested response sub-models ────────────────────────────────────────────────

class ReasonCode(BaseModel):
    """An FCRA §615 adverse action code with plain-English explanation."""

    code: str = Field(..., description="Short machine-readable code, e.g. 'INCOME_BELOW_MINIMUM'")
    fcra_code: str = Field(..., description="FCRA §615 code, e.g. 'AA-01'")
    description: str = Field(..., description="Plain-English explanation shown to consumers")


class AuditSummary(BaseModel):
    """Audit metadata attached to every decision response."""

    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of the decision")
    model_version: str = Field(..., description="Artifact version used for inference")
    rules_triggered: list[str] = Field(
        default_factory=list,
        description="Names of hard rules that evaluated to true",
    )
    processing_time_ms: float = Field(
        ...,
        ge=0,
        description="End-to-end processing time in milliseconds",
    )


# ── Top-level response ────────────────────────────────────────────────────────

class UnderwritingResponse(BaseModel):
    """Full underwriting decision response (API contract §4.5)."""

    decision_id: str = Field(..., description="UUID4 decision identifier for audit trail linkage")
    decision: Literal["approve", "reject", "review"] = Field(
        ...,
        description="Underwriting outcome",
    )
    credit_limit: Optional[float] = Field(
        default=None,
        description="Approved credit limit in USD; null when rejected",
    )
    apr: Optional[float] = Field(
        default=None,
        description="Annual percentage rate; null when rejected",
    )
    confidence_score: float = Field(
        ...,
        ge=0,
        le=1,
        description="Model confidence: abs(probability − 0.5) × 2",
    )
    risk_segment: str = Field(
        ...,
        description="prime | near-prime | high-risk | thin-file",
    )
    reason_codes: list[ReasonCode] = Field(
        default_factory=list,
        description="Adverse action codes (required for reject/review decisions)",
    )
    explanations: dict[str, float] = Field(
        default_factory=dict,
        description="SHAP feature contributions; positive = supports approval",
    )
    audit: AuditSummary = Field(..., description="Provenance and audit metadata")
    portfolio_context: Optional[dict] = Field(
        default=None,
        description=(
            "Applicant benchmarked against Freddie Mac SFLLD portfolio (2015–2024, 15.9 M loans). "
            "Includes credit-score percentile, peer default rate, and population benchmarks."
        ),
    )


# ── History / pagination ──────────────────────────────────────────────────────

class DecisionSummary(BaseModel):
    """Compact representation of a decision for the history list."""

    decision_id: str
    created_at: datetime
    decision: str
    credit_limit: Optional[float]
    apr: Optional[float]
    risk_segment: Optional[str]
    reason_codes: list[Any]
    demo_mode: bool


class PaginatedDecisions(BaseModel):
    """Paginated list of decisions."""

    items: list[DecisionSummary]
    total: int
    page: int
    pages: int


# ── RFC 7807 error ────────────────────────────────────────────────────────────

class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details for HTTP APIs."""

    type: str = Field(default="https://agenthive.ai/errors/validation")
    title: str
    status: int
    detail: str
    instance: str


# ── Batch response ────────────────────────────────────────────────────────────

class BatchDecisionResponse(BaseModel):
    """Summary of a bulk CSV decision run."""

    total_rows: int
    processed: int
    approved: int
    rejected: int
    reviewed: int
    failed: int
    approval_rate: float
    elapsed_seconds: float
    errors: list[dict[str, Any]] = Field(default_factory=list)
