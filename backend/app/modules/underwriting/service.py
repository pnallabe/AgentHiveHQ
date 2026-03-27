"""Underwriting service — orchestrates feature engineering, rules, model, and DB.

Follows the Single Responsibility layering defined in CODING_PROMPT.md §2:
  feature_engineering  →  rules_engine  →  model  →  DB write  →  response

DEMO_RESPONSES provides six pre-computed, deterministic scenario outcomes.
When demo_mode=True, live inference is skipped and the scenario outcome is
served directly.  The record is still written to the DB with demo_mode=True.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.modules.underwriting.model import load_or_mock, UnderwritingModel, MockUnderwritingModel
from app.shared.explainability import SHAPExplainer, MockSHAPExplainer
from app.modules.underwriting.schemas import (
    AuditSummary,
    ReasonCode,
    UnderwritingRequest,
    UnderwritingResponse,
)
from app.shared import feature_engineering, rules_engine
from app.shared.db_models import AuditLog, DecisionRecord
from app.shared import loan_portfolio

logger = get_logger(__name__)

# ── Singleton model + SHAP explainer (loaded once at startup) ─────────────────
_model = load_or_mock()

# Initialise SHAP explainer if real model was loaded
if isinstance(_model, UnderwritingModel):
    try:
        _shap_explainer: SHAPExplainer | MockSHAPExplainer = SHAPExplainer.from_model(_model)
        logger.info("SHAPExplainer ready (LinearExplainer)")
    except Exception as _exc:
        logger.warning(f"SHAPExplainer init failed: {_exc} — using mock SHAP")
        _shap_explainer = MockSHAPExplainer()
else:
    _shap_explainer = MockSHAPExplainer()


# ── Reason code plain-English catalogue ──────────────────────────────────────
_REASON_DESCRIPTIONS: dict[str, str] = {
    "INCOME_BELOW_MINIMUM":   "Your annual income is below our minimum lending threshold of $18,000.",
    "INVALID_EMPLOYMENT_DATA":"The employment data provided could not be verified.",
    "CREDIT_SCORE_TOO_LOW":   "Your credit score is currently below the minimum required for approval.",
    "THIN_FILE_LOW_INCOME":   "Limited credit history combined with income below $40,000 requires manual review.",
    "HIGH_RISK_PROFILE":      "The combination of risk factors exceeds our current underwriting guidelines.",
}

_FCRA_CODES: dict[str, str] = {
    "INCOME_BELOW_MINIMUM":   "AA-01",
    "INVALID_EMPLOYMENT_DATA":"AA-09",
    "CREDIT_SCORE_TOO_LOW":   "AA-02",
    "THIN_FILE_LOW_INCOME":   "AA-07",
    "HIGH_RISK_PROFILE":      "AA-03",
}


# ── Demo mode response map ────────────────────────────────────────────────────
# All six pre-defined scenarios.  Shapes must match UnderwritingResponse exactly.
# decision_id and audit.timestamp are injected at serve-time (not stored here).

DEMO_RESPONSES: dict[str, dict[str, Any]] = {
    "prime_applicant": {
        "decision": "approve",
        "credit_limit": 15_000.0,
        "apr": 14.99,
        "confidence_score": 0.9210,
        "risk_segment": "prime",
        "reason_codes": [],
        "explanations": {
            "credit_score_imputed": 0.62,
            "income_log":           0.48,
            "employment_length":    0.18,
            "housing_encoded":      0.14,
            "thin_file_flag":      -0.02,
            "income_band":          0.11,
        },
    },
    "near_prime": {
        "decision": "approve",
        "credit_limit": 5_500.0,
        "apr": 19.99,
        "confidence_score": 0.6140,
        "risk_segment": "near-prime",
        "reason_codes": [],
        "explanations": {
            "credit_score_imputed": 0.28,
            "income_log":           0.32,
            "employment_length":    0.09,
            "housing_encoded":      0.00,
            "thin_file_flag":      -0.05,
            "income_band":          0.06,
        },
    },
    "thin_file": {
        "decision": "review",
        "credit_limit": None,
        "apr": None,
        "confidence_score": 0.3800,
        "risk_segment": "thin-file",
        "reason_codes": [
            {
                "code": "THIN_FILE_LOW_INCOME",
                "fcra_code": "AA-07",
                "description": _REASON_DESCRIPTIONS["THIN_FILE_LOW_INCOME"],
            }
        ],
        "explanations": {
            "credit_score_imputed":  0.00,
            "income_log":            0.14,
            "employment_length":     0.06,
            "housing_encoded":       0.00,
            "thin_file_flag":       -0.55,
            "income_band":           0.02,
        },
    },
    "gig_worker": {
        "decision": "approve",
        "credit_limit": 4_000.0,
        "apr": 24.99,
        "confidence_score": 0.5520,
        "risk_segment": "near-prime",
        "reason_codes": [],
        "explanations": {
            "credit_score_imputed": 0.20,
            "income_log":           0.24,
            "employment_length":    0.02,
            "housing_encoded":      0.00,
            "thin_file_flag":      -0.08,
            "income_band":          0.04,
        },
    },
    "new_immigrant": {
        "decision": "review",
        "credit_limit": None,
        "apr": None,
        "confidence_score": 0.4120,
        "risk_segment": "thin-file",
        "reason_codes": [
            {
                "code": "THIN_FILE_LOW_INCOME",
                "fcra_code": "AA-07",
                "description": _REASON_DESCRIPTIONS["THIN_FILE_LOW_INCOME"],
            }
        ],
        "explanations": {
            "credit_score_imputed":  0.00,
            "income_log":            0.18,
            "employment_length":     0.01,
            "housing_encoded":       0.00,
            "thin_file_flag":       -0.48,
            "income_band":           0.03,
        },
    },
    "high_risk": {
        "decision": "reject",
        "credit_limit": None,
        "apr": None,
        "confidence_score": 0.8660,
        "risk_segment": "high-risk",
        "reason_codes": [
            {
                "code": "CREDIT_SCORE_TOO_LOW",
                "fcra_code": "AA-02",
                "description": _REASON_DESCRIPTIONS["CREDIT_SCORE_TOO_LOW"],
            }
        ],
        "explanations": {
            "credit_score_imputed": -0.56,
            "income_log":            0.10,
            "employment_length":     0.04,
            "housing_encoded":      -0.06,
            "thin_file_flag":       -0.02,
            "income_band":           0.03,
        },
    },
}

_DEMO_FALLBACK_KEY = "near_prime"


# ── Service ───────────────────────────────────────────────────────────────────

class UnderwritingService:
    """Orchestrates the full underwriting decision pipeline."""

    async def decide(
        self,
        request: UnderwritingRequest,
        db: AsyncSession,
    ) -> UnderwritingResponse:
        """Run the underwriting pipeline and persist the result.

        Pipeline:
          1. Demo mode check → serve from DEMO_RESPONSES if applicable.
          2. Feature engineering.
          3. Hard rules evaluation.
          4. Mock ML model scoring (bypassed when a rule fires).
          5. DB write (DecisionRecord + AuditLog).
          6. Assemble and return UnderwritingResponse.
        """
        t_start = time.perf_counter()
        decision_id = str(uuid.uuid4())
        model_version = _model.MODEL_VERSION

        if request.demo_mode:
            return await self._serve_demo(request, db, decision_id, t_start)

        # ── Live pipeline ─────────────────────────────────────────────────────
        raw = request.model_dump()
        features = feature_engineering.transform(raw)
        rules_triggered: list[str] = []
        reason_codes: list[ReasonCode] = []

        rule_result = rules_engine.evaluate(features)

        if rule_result is not None:
            # Hard rule overrides the model.
            decision = rule_result.decision
            credit_limit = None
            apr_value = None
            confidence_score = 1.0  # Rules are deterministic — maximum confidence.
            risk_segment = "high-risk" if decision == "reject" else "thin-file"
            shap_values = _shap_explainer.explain(features)
            rules_triggered = [rule_result.rule_name]
            reason_codes = [
                ReasonCode(
                    code=rule_result.reason_code,
                    fcra_code=rule_result.fcra_code,
                    description=_REASON_DESCRIPTIONS.get(rule_result.reason_code, rule_result.reason_code),
                )
            ]
            model_version = "rules-1.0.0"
        else:
            # ML model path.
            output = _model.predict(features)
            decision = output.decision
            credit_limit = output.credit_limit if decision == "approve" else None
            apr_value = output.apr if decision == "approve" else None
            confidence_score = output.confidence_score
            risk_segment = output.risk_segment
            shap_values = _shap_explainer.explain(features)

            if decision in ("reject", "review"):
                # Attach a generic adverse action code when no specific rule fired.
                reason_codes = [
                    ReasonCode(
                        code="HIGH_RISK_PROFILE",
                        fcra_code=_FCRA_CODES["HIGH_RISK_PROFILE"],
                        description=_REASON_DESCRIPTIONS["HIGH_RISK_PROFILE"],
                    )
                ]

        elapsed_ms = (time.perf_counter() - t_start) * 1_000
        timestamp = datetime.now(tz=timezone.utc).isoformat()

        # ── Persist ───────────────────────────────────────────────────────────
        await self._persist(
            db=db,
            decision_id=decision_id,
            request=request,
            decision=decision,
            credit_limit=credit_limit,
            apr=apr_value,
            confidence_score=confidence_score,
            risk_segment=risk_segment,
            reason_codes=[rc.model_dump() for rc in reason_codes],
            shap_values=shap_values,
            model_version=model_version,
            rules_triggered=rules_triggered,
            demo_mode=False,
            event_metadata={"elapsed_ms": round(elapsed_ms, 2)},
        )

        # ── Freddie Mac portfolio benchmark (non-blocking) ───────────────────
        portfolio_ctx: dict | None = None
        try:
            portfolio_ctx = await loan_portfolio.get_benchmark_for_applicant(
                credit_score=request.credit_score,
            )
        except Exception as _bq_exc:
            logger.debug("portfolio benchmark unavailable", extra={"error": str(_bq_exc)})

        return UnderwritingResponse(
            decision_id=decision_id,
            decision=decision,
            credit_limit=credit_limit,
            apr=apr_value,
            confidence_score=confidence_score,
            risk_segment=risk_segment,
            reason_codes=reason_codes,
            explanations=shap_values,
            portfolio_context=portfolio_ctx,
            audit=AuditSummary(
                timestamp=timestamp,
                model_version=f"sha256:{_model.artifact_hash[:12]}" if hasattr(_model, 'artifact_hash') and _model.artifact_hash and _model.artifact_hash != 'mock' else model_version,
                rules_triggered=rules_triggered,
                processing_time_ms=round(elapsed_ms, 2),
            ),
        )

    # ── Demo mode ─────────────────────────────────────────────────────────────

    async def _serve_demo(
        self,
        request: UnderwritingRequest,
        db: AsyncSession,
        decision_id: str,
        t_start: float,
    ) -> UnderwritingResponse:
        tag = request.scenario_tag or _DEMO_FALLBACK_KEY
        template = DEMO_RESPONSES.get(tag, DEMO_RESPONSES[_DEMO_FALLBACK_KEY])

        elapsed_ms = (time.perf_counter() - t_start) * 1_000
        timestamp = datetime.now(tz=timezone.utc).isoformat()
        model_version = "demo-1.0.0"

        reason_codes = [
            ReasonCode(**rc) for rc in template["reason_codes"]
        ]

        await self._persist(
            db=db,
            decision_id=decision_id,
            request=request,
            decision=template["decision"],
            credit_limit=template["credit_limit"],
            apr=template["apr"],
            confidence_score=template["confidence_score"],
            risk_segment=template["risk_segment"],
            reason_codes=template["reason_codes"],
            shap_values=template["explanations"],
            model_version=model_version,
            rules_triggered=[],
            demo_mode=True,
            event_metadata={"scenario_tag": tag, "elapsed_ms": round(elapsed_ms, 2)},
        )

        return UnderwritingResponse(
            decision_id=decision_id,
            decision=template["decision"],
            credit_limit=template["credit_limit"],
            apr=template["apr"],
            confidence_score=template["confidence_score"],
            risk_segment=template["risk_segment"],
            reason_codes=reason_codes,
            explanations=template["explanations"],
            audit=AuditSummary(
                timestamp=timestamp,
                model_version=model_version,
                rules_triggered=[],
                processing_time_ms=round(elapsed_ms, 2),
            ),
        )

    # ── DB helpers ────────────────────────────────────────────────────────────

    @staticmethod
    async def _persist(
        *,
        db: AsyncSession,
        decision_id: str,
        request: UnderwritingRequest,
        decision: str,
        credit_limit: Optional[float],
        apr: Optional[float],
        confidence_score: float,
        risk_segment: str,
        reason_codes: List[dict],
        shap_values: dict,
        model_version: str,
        rules_triggered: List[str],
        demo_mode: bool,
        event_metadata: dict,
    ) -> None:
        record = DecisionRecord(
            id=decision_id,
            input_payload=request.model_dump(),
            decision=decision,
            credit_limit=credit_limit,
            apr=apr,
            confidence_score=confidence_score,
            risk_segment=risk_segment,
            reason_codes=reason_codes,
            shap_values=shap_values,
            model_version=model_version,
            rules_triggered=rules_triggered,
            demo_mode=demo_mode,
        )
        db.add(record)
        await db.flush()  # Obtain PK before audit log write.

        audit = AuditLog(
            decision_id=decision_id,
            event_type="decision_made",
            actor="system",
            metadata_=event_metadata,
        )
        db.add(audit)
        # Session.commit() is called by the `get_db` dependency on success.
        logger.info(
            "Decision persisted",
            extra={"decision_id": decision_id, "decision": decision, "demo_mode": demo_mode},
        )
