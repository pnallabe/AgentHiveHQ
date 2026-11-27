"""Gated sample-audit-package download.

A public endpoint that emails a real (synthetic-data) Model Validation Report
JSON to a prospect who supplies their work email. This is the artifact-led CTA
behind the /audit-package page — the prospect gets the actual document an
SR 11-7 examiner receives, and the team captures a qualified lead.

Flow:
    1. Prospect submits name/email/company on the /audit-package page.
    2. We persist a TenantInquiry (referral="audit-package-download") so the
       lead lands in the same pipeline as demo requests.
    3. We email the prospect the sample MVR JSON (generated from synthetic
       demo data) with Reply-To set to the founder's inbox.
    4. We notify the founder (same as a demo request).

Mounted under the inquiries router:
    POST /api/v1/sample-audit-package
"""
from __future__ import annotations

import asyncio
import json
from email.message import EmailMessage
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.modules.inquiries.notifications import _send_sync

logger = get_logger(__name__)


def _build_sample_mvr() -> dict[str, Any]:
    """A representative MVR built from synthetic demo data.

    Structured identically to the live /api/governance/exam-package output so
    prospects see the real artifact shape. Clearly marked as synthetic.
    """
    return {
        "report_type": "Model Validation Report (MVR) — Exam Package",
        "framework": "SR 11-7 / OCC 2011-12 Supervisory Guidance on Model Risk Management",
        "mvr_version": "1.0.0",
        "generated_at": "2026-11-26T00:00:00+00:00",
        "generated_by": "AgentHive Audit Fabric (automated)",
        "data_notice": "SYNTHETIC DEMO DATA — illustrative sample, not a live tenant export",
        "tenant": {"slug": "demo-lender", "exported_by": "demo@agenthivehq.com"},
        "sections": {
            "1_model_inventory": {
                "model_name": "RuleSense Underwriting Engine",
                "model_type": "Gradient-boosted probability-of-default classifier with monotonic constraints",
                "intended_use": (
                    "Real-time consumer credit underwriting for prime, near-prime, and "
                    "thin-file applicants. Produces approve/decline/review decisions, "
                    "credit limit, and APR with SHAP-derived adverse-action reason codes."
                ),
                "owner": "Head of Model Risk",
                "deployment_mode": "Cloud Run managed API, tenant-scoped",
                "data_sources": [
                    "Applicant-supplied income and employment data",
                    "Bank-feed cash-flow signals (volatility, stability)",
                    "Alternative trade-lines (rent, utilities) where available",
                ],
                "segments_observed": {"prime": 412, "near_prime": 268, "thin_file": 197},
            },
            "2_validation_evidence": {
                "performance_monitoring": {
                    "period": "last_90_days",
                    "total_decisions": 877,
                    "approval_rate": 0.713,
                    "approval_rate_by_segment": {
                        "prime": 0.91,
                        "near_prime": 0.68,
                        "thin_file": 0.42,
                    },
                    "average_credit_limit": 8450.0,
                    "average_apr": 14.2,
                },
                "fair_lending_testing": {
                    "methodology": "Four-fifths (80%) rule across income bands",
                    "adverse_impact_ratio": 0.86,
                    "disparate_impact_flag": False,
                    "threshold": 0.80,
                    "income_band_analysis": {
                        "band_0_under_25k": {"total": 142, "approved": 78, "rate": 0.549},
                        "band_1_25k_50k": {"total": 233, "approved": 152, "rate": 0.652},
                        "band_2_50k_100k": {"total": 318, "approved": 243, "rate": 0.764},
                        "band_3_over_100k": {"total": 184, "approved": 153, "rate": 0.832},
                    },
                },
                "explainability": {
                    "method": "SHAP per-decision feature attribution",
                    "top_reason_codes": [
                        {"code": "INSUFFICIENT_INCOME_STABILITY", "count": 96, "pct": 0.109},
                        {"code": "THIN_CREDIT_HISTORY", "count": 71, "pct": 0.081},
                        {"code": "HIGH_DTI_RATIO", "count": 58, "pct": 0.066},
                    ],
                    "adverse_action_codes": "FCRA/ECOA-aligned reason codes on every non-approve decision",
                },
            },
            "3_governance_controls": {
                "audit_trail": {
                    "record_count": 877,
                    "chain_of_custody": "Immutable, hash-chained decision log (ISO 8601 timestamps)",
                    "sample_records": [
                        {
                            "audit_id": "aud_01J9...",
                            "created_at": "2026-11-20T14:03:11+00:00",
                            "event_type": "decision.created",
                            "decision": "approve",
                            "model_version": "rulesense-v2.4.1",
                        },
                        {
                            "audit_id": "aud_01J8...",
                            "created_at": "2026-11-20T13:58:44+00:00",
                            "event_type": "decision.created",
                            "decision": "review",
                            "model_version": "rulesense-v2.4.1",
                        },
                    ],
                },
                "controls": [
                    "Every decision persisted with model version, input payload hash, and SHAP values",
                    "Tenant-scoped access control — members can only export their own records",
                    "Demo-mode records excluded from all governance metrics",
                    "Continuous adverse-impact monitoring with automated flag below 0.80",
                    "Model version registry with deploy timestamps",
                ],
            },
        },
        "attestation": (
            "This sample was generated by the AgentHive Audit Fabric exam-package "
            "generator. In production, every metric, audit record, and bias analysis "
            "is derived from persisted live decisioning data as of the generation timestamp."
        ),
    }


def _build_prospect_message(name: str, email: str, company: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Your AgentHive sample audit package (SR 11-7 MVR)"
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = email
    msg["Reply-To"] = settings.INQUIRY_NOTIFY_TO or settings.SMTP_USERNAME

    sample = _build_sample_mvr()
    payload = json.dumps(sample, indent=2)

    msg.set_content(
        f"Hi {name or 'there'},\n\n"
        f"Thanks for your interest in AgentHive. Attached below is a sample Model\n"
        f"Validation Report — the exact SR 11-7 exam package our Audit Fabric\n"
        f"generates from live decisioning data (this copy uses synthetic demo data).\n\n"
        f"It contains the three sections an examiner requests:\n"
        f"  1. Model inventory & intended use\n"
        f"  2. Validation evidence (performance + four-fifths fair-lending testing)\n"
        f"  3. Governance controls & the immutable audit trail\n\n"
        f"In production this is generated on demand from your own decisions —\n"
        f"no manual assembly. Reply to this email if you'd like to see it run\n"
        f"against a live tenant.\n\n"
        f"— The AgentHive team\n\n"
        f"{'=' * 72}\n"
        f"SAMPLE MODEL VALIDATION REPORT (JSON)\n"
        f"{'=' * 72}\n\n"
        f"{payload}\n"
    )
    return msg


async def send_sample_package(name: str, email: str, company: str) -> bool:
    """Email the sample MVR to the prospect. Returns True on success."""
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — cannot send sample package")
        return False
    try:
        msg = _build_prospect_message(name, email, company)
        await asyncio.to_thread(_send_sync, msg)
        logger.info("Sample package sent", extra={"to": email, "company": company})
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to send sample package", extra={"to": email, "error": str(exc)})
        return False
