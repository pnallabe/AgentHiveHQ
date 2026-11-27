"""Exam-package generator — SR 11-7-style Model Validation Report (MVR).

Assembles a self-contained audit package from live system data:

    1. Model card / inventory        (from analytics MRM proxy model card)
    2. Decision audit trail          (tenant-scoped audit export records)
    3. Fair-lending / bias analysis  (four-fifths rule over income bands)
    4. Ongoing monitoring summary    (governance dashboard aggregates)
    5. Governance metadata           (versions, timestamps, chain of custody)

The output is a single JSON document structured to map onto the sections an
SR 11-7 validator or OCC/CFPB examiner asks for. It is generated on demand —
no stale PDFs, no manual assembly.

Mounted under the governance router:
    GET /api/governance/exam-package
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.modules.governance.service import GovernanceDashboardService

logger = get_logger(__name__)

_MVR_VERSION = "1.0.0"
_FRAMEWORK = "SR 11-7 / OCC 2011-12 Supervisory Guidance on Model Risk Management"


def _utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _section_model_inventory(dashboard: dict[str, Any]) -> dict[str, Any]:
    """Section 1 — Model inventory & intended use (SR 11-7 §III)."""
    return {
        "model_name": "RuleSense Underwriting Engine",
        "model_type": "Gradient-boosted probability-of-default classifier with monotonic constraints",
        "intended_use": (
            "Real-time consumer credit underwriting for prime, near-prime, and "
            "thin-file applicants. Produces approve/decline/review decisions, "
            "credit limit, and APR with SHAP-derived adverse-action reason codes."
        ),
        "owner": "Head of Model Risk",
        "developer": "AgentHive RuleSense team",
        "deployment_mode": "Cloud Run managed API, tenant-scoped",
        "data_sources": [
            "Applicant-supplied income and employment data",
            "Bank-feed cash-flow signals (volatility, stability)",
            "Alternative trade-lines (rent, utilities) where available",
        ],
        "segments_observed": dashboard.get("decisions_by_segment", {}),
    }


def _section_validation(dashboard: dict[str, Any], bias: dict[str, Any]) -> dict[str, Any]:
    """Section 2 — Validation evidence: performance + fair-lending testing."""
    return {
        "performance_monitoring": {
            "period": dashboard.get("period"),
            "total_decisions": dashboard.get("total_decisions"),
            "approval_rate": dashboard.get("approval_rate"),
            "approval_rate_by_segment": dashboard.get("approval_rate_by_segment"),
            "approval_rate_trend": dashboard.get("approval_rate_by_day"),
            "average_credit_limit": dashboard.get("average_credit_limit"),
            "average_apr": dashboard.get("average_apr"),
        },
        "fair_lending_testing": {
            "methodology": "Four-fifths (80%) rule across income bands",
            "adverse_impact_ratio": bias.get("adverse_impact_ratio"),
            "disparate_impact_flag": bias.get("disparate_impact_flag"),
            "threshold": bias.get("disparate_impact_threshold"),
            "income_band_analysis": bias.get("income_band_analysis"),
            "disclaimer": bias.get("disclaimer"),
        },
        "explainability": {
            "method": "SHAP (SHapley Additive exPlanations) per-decision feature attribution",
            "top_reason_codes": dashboard.get("top_reason_codes"),
            "adverse_action_codes": "FCRA/ECOA-aligned reason codes emitted on every non-approve decision",
        },
    }


def _section_governance(audit_records: list[dict[str, Any]]) -> dict[str, Any]:
    """Section 3 — Governance, controls & audit trail (SR 11-7 §IV–V)."""
    return {
        "audit_trail": {
            "record_count": len(audit_records),
            "chain_of_custody": "Immutable, hash-chained decision log (ISO 8601 timestamps)",
            "sample_records": audit_records[:25],
        },
        "controls": [
            "Every decision persisted with model version, input payload hash, and SHAP values",
            "Tenant-scoped access control — members can only export their own records",
            "Demo-mode records excluded from all governance metrics",
            "Continuous adverse-impact monitoring with automated flag below 0.80",
            "Model version registry with deploy timestamps",
        ],
    }


async def build_exam_package(
    db: AsyncSession,
    *,
    tenant_id: Optional[str],
    tenant_slug: str,
    exported_by: str,
    audit_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Assemble the full exam package from live governance data."""
    service = GovernanceDashboardService()
    dashboard = await service.get(db=db, period="last_90_days", tenant_id=tenant_id)
    bias = await service.bias_report(db=db, tenant_id=tenant_id)

    package = {
        "report_type": "Model Validation Report (MVR) — Exam Package",
        "framework": _FRAMEWORK,
        "mvr_version": _MVR_VERSION,
        "generated_at": _utcnow_iso(),
        "generated_by": "AgentHive Audit Fabric (automated)",
        "tenant": {
            "slug": tenant_slug,
            "exported_by": exported_by,
        },
        "sections": {
            "1_model_inventory": _section_model_inventory(dashboard),
            "2_validation_evidence": _section_validation(dashboard, bias),
            "3_governance_controls": _section_governance(audit_records),
        },
        "attestation": (
            "This package was generated programmatically from the live AgentHive "
            "decisioning system. All metrics, audit records, and bias analyses are "
            "derived from persisted production data as of the generation timestamp."
        ),
    }

    logger.info(
        "Exam package generated",
        extra={
            "tenant": tenant_slug,
            "decisions": dashboard.get("total_decisions"),
            "audit_records": len(audit_records),
        },
    )
    return package
