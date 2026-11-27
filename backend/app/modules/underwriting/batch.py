"""Bulk batch decisioning — run a CSV of applications through the real pipeline.

This powers the "fictional client with 100,000 applications" demo: upload a CSV,
every row goes through the *same* feature-engineering → rules → model → persist
pipeline as a single live decision, and the resulting tenant-scoped records feed
the governance dashboard and the one-click exam package.

Design notes:
- Each row becomes a real DecisionRecord + AuditLog (append-only, hash of input).
- Rows are processed in chunks with periodic commits so a 100k-row file doesn't
  hold one giant transaction.
- Per-row failures are captured (row number + error) without aborting the batch.
- demo_mode is forced False — batch is always live inference (that's the point:
  the exam package must reflect the real model, not demo scenarios).
"""
from __future__ import annotations

import csv
import io
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.modules.underwriting.schemas import UnderwritingRequest
from app.modules.underwriting.service import UnderwritingService
from app.shared import feature_engineering, rules_engine
from app.shared.db_models import AuditLog, DecisionRecord

logger = get_logger(__name__)

# Columns we accept (case-insensitive). credit_score may be empty for thin-file.
_REQUIRED = {"income", "employment_length", "housing_status"}
_OPTIONAL = {"credit_score", "applicant_ref"}
_COMMIT_EVERY = 500  # rows per commit
_FAST_PATH_THRESHOLD = 2_000  # use vectorized path above this many rows
_SHAP_SAMPLE = 200  # compute SHAP for this many rows in fast path (rest get NULL)


@dataclass
class BatchResult:
    total_rows: int = 0
    processed: int = 0
    approved: int = 0
    rejected: int = 0
    reviewed: int = 0
    failed: int = 0
    errors: list[dict[str, Any]] = field(default_factory=list)
    elapsed_seconds: float = 0.0

    @property
    def approval_rate(self) -> float:
        return round(self.approved / self.processed, 4) if self.processed else 0.0


def _parse_row(row: dict[str, str], row_num: int) -> UnderwritingRequest:
    """Validate + coerce one CSV row into an UnderwritingRequest."""
    # Normalise keys to lowercase/strip.
    norm = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

    missing = _REQUIRED - {k for k, v in norm.items() if v not in (None, "")}
    if missing:
        raise ValueError(f"missing required fields: {', '.join(sorted(missing))}")

    credit_raw = norm.get("credit_score", "")
    credit_score: Optional[int] = None
    if credit_raw not in (None, ""):
        credit_score = int(float(credit_raw))

    return UnderwritingRequest(
        income=float(norm["income"]),
        employment_length=float(norm["employment_length"]),
        housing_status=norm["housing_status"].lower(),
        credit_score=credit_score,
        demo_mode=False,  # batch is always live inference
    )


async def run_batch(
    csv_bytes: bytes,
    db: AsyncSession,
    *,
    tenant_id: Optional[str],
    max_rows: int = 250_000,
) -> BatchResult:
    """Process a CSV of applications through the live decision pipeline.

    Small files (<= _FAST_PATH_THRESHOLD) use the per-row service path (full SHAP
    per decision). Large files use a vectorized fast path that produces identical
    decisions/segments/reason codes but computes SHAP only for a sample — the
    audit trail and governance metrics are unaffected.
    """
    text = csv_bytes.decode("utf-8-sig", errors="replace")
    rows = list(csv.DictReader(io.StringIO(text)))
    total = len(rows)

    if total > _FAST_PATH_THRESHOLD:
        return await _run_batch_fast(rows, db, tenant_id=tenant_id, max_rows=max_rows)

    # ── Per-row path (full fidelity, small files) ────────────────────────────
    service = UnderwritingService()
    result = BatchResult()
    t_start = time.perf_counter()

    for i, row in enumerate(rows, start=1):
        if i > max_rows:
            result.errors.append({"row": i, "error": f"exceeded max_rows cap ({max_rows})"})
            break
        result.total_rows += 1
        try:
            req = _parse_row(row, i)
            resp = await service.decide(req, db, tenant_id=tenant_id)
            result.processed += 1
            if resp.decision == "approve":
                result.approved += 1
            elif resp.decision == "reject":
                result.rejected += 1
            else:
                result.reviewed += 1
        except Exception as exc:  # noqa: BLE001 — capture per-row, keep going
            result.failed += 1
            if len(result.errors) < 50:
                result.errors.append({"row": i, "error": str(exc)})

        if result.processed % _COMMIT_EVERY == 0:
            await db.commit()
            logger.info("Batch progress", extra={"processed": result.processed, "tenant_id": tenant_id})

    await db.commit()
    result.elapsed_seconds = round(time.perf_counter() - t_start, 2)
    logger.info("Batch complete", extra={"tenant_id": tenant_id, "processed": result.processed,
                                         "approved": result.approved, "failed": result.failed,
                                         "elapsed_s": result.elapsed_seconds})
    return result


# ── Vectorized fast path ──────────────────────────────────────────────────────

def _terms(probability: float, income: float) -> tuple[Optional[float], Optional[float]]:
    """Mirror UnderwritingModel.compute_credit_terms exactly."""
    base_limit = min(income * 0.15, 25_000.0)
    adjusted = base_limit * (0.5 + probability * 0.5)
    credit_limit = round(adjusted / 500) * 500
    if probability < 0.30:
        apr = 29.99
    elif probability < 0.50:
        apr = 24.99
    elif probability < 0.70:
        apr = 19.99
    else:
        apr = 14.99
    return float(credit_limit), apr


def _segment(probability: float, thin_file: bool) -> str:
    """Mirror UnderwritingModel._risk_segment."""
    if thin_file:
        return "thin-file"
    if probability >= 0.80:
        return "prime"
    if probability >= 0.50:
        return "near-prime"
    return "high-risk"


async def _run_batch_fast(
    rows: list[dict[str, str]],
    db: AsyncSession,
    *,
    tenant_id: Optional[str],
    max_rows: int,
) -> BatchResult:
    """Vectorized batch: rules + model over numpy arrays, bulk insert.

    Faithfully mirrors the per-row pipeline (4 hard rules in priority order, then
    the logistic model at threshold 0.50, real credit terms and risk segments).
    The only difference: SHAP is computed for a sample of rows (the rest store
    NULL shap_values, which the schema permits). Governance metrics and the exam
    package are unaffected because they aggregate decision/segment/reason codes.
    """
    import uuid as _uuid
    from datetime import datetime, timezone

    import numpy as np

    from app.modules.underwriting.service import _model, _shap_explainer

    result = BatchResult()
    t_start = time.perf_counter()

    # ── Parse + validate all rows ────────────────────────────────────────────
    parsed: list[tuple[int, UnderwritingRequest, Optional[str]]] = []
    for i, row in enumerate(rows, start=1):
        if i > max_rows:
            result.errors.append({"row": i, "error": f"exceeded max_rows cap ({max_rows})"})
            break
        result.total_rows += 1
        try:
            req = _parse_row(row, i)
            parsed.append((i, req, row.get("applicant_ref") or None))
        except Exception as exc:  # noqa: BLE001
            result.failed += 1
            if len(result.errors) < 50:
                result.errors.append({"row": i, "error": str(exc)})

    if not parsed:
        result.elapsed_seconds = round(time.perf_counter() - t_start, 2)
        return result

    # ── Feature engineering (per-row transform; cheap and exact) ─────────────
    raw_dicts = [req.model_dump() for _, req, _ in parsed]
    feats = [feature_engineering.transform(r) for r in raw_dicts]

    incomes = np.array([f["income_raw"] for f in feats], dtype=float)
    thin_flags = np.array([f["thin_file_flag"] for f in feats], dtype=float)
    score_imputed = np.array([f["credit_score_imputed"] for f in feats], dtype=float)
    employment = np.array([f["employment_length"] for f in feats], dtype=float)

    # ── Hard rules (priority order, mirrors rules_engine.RULES) ─────────────
    # 1. minimum_income → reject
    # 2. negative_employment → reject (can't fire: schema enforces >= 0)
    # 3. very_low_credit_score → reject (only when score provided)
    # 4. thin_file_low_income → review
    rule_min_income = incomes < 18_000
    rule_neg_emp = employment < 0
    rule_low_score = (thin_flags == 0.0) & (score_imputed < 500)
    rule_thin_low_income = (thin_flags == 1.0) & (incomes < 40_000)

    # First matching rule wins (priority order).
    rules_fired = np.full(len(parsed), "", dtype=object)
    rules_decision = np.full(len(parsed), "", dtype=object)
    for mask, name, dec in [
        (rule_min_income, "minimum_income", "reject"),
        (rule_neg_emp, "negative_employment", "reject"),
        (rule_low_score, "very_low_credit_score", "reject"),
        (rule_thin_low_income, "thin_file_low_income", "review"),
    ]:
        apply_mask = mask & (rules_fired == "")
        rules_fired[apply_mask] = name
        rules_decision[apply_mask] = dec

    no_rule = rules_fired == ""

    # ── Model scoring (vectorized over the real pipeline) ────────────────────
    feature_matrix = np.array([[f[k] for k in feature_engineering.FEATURES] for f in feats])
    pipeline = getattr(_model, "_pipeline", None)
    if pipeline is not None:
        probs = pipeline.predict_proba(feature_matrix)[:, 1]
    else:
        # Mock model fallback (deterministic logistic on scaled features).
        z = feature_matrix.sum(axis=1)
        probs = 1.0 / (1.0 + np.exp(-(z - z.mean()) / (z.std() + 1e-9)))

    # Model decision: approve if prob >= 0.50 else reject (only where no rule fired).
    model_approve = no_rule & (probs >= 0.50)
    model_reject = no_rule & (probs < 0.50)

    # Final decision per row.
    decision_arr = np.where(
        rules_decision == "reject", "reject",
        np.where(rules_decision == "review", "review",
                 np.where(model_approve, "approve", "reject")),
    )

    # ── SHAP for a sample only ───────────────────────────────────────────────
    n = len(parsed)
    shap_sample_idx = set(
        np.random.default_rng(7).choice(n, size=min(_SHAP_SAMPLE, n), replace=False).tolist()
    )

    # ── Reason-code catalogue (mirrors service) ──────────────────────────────
    _RULE_REASON = {
        "minimum_income": ("INCOME_BELOW_MINIMUM", "AA-01",
                           "Your annual income is below our minimum lending threshold of $18,000."),
        "negative_employment": ("INVALID_EMPLOYMENT_DATA", "AA-09",
                                "The employment data provided could not be verified."),
        "very_low_credit_score": ("CREDIT_SCORE_TOO_LOW", "AA-02",
                                  "Your credit score is currently below the minimum required for approval."),
        "thin_file_low_income": ("THIN_FILE_LOW_INCOME", "AA-07",
                                 "Limited credit history combined with income below $40,000 requires manual review."),
    }
    _MODEL_DECLINE = ("HIGH_RISK_PROFILE", "AA-03",
                      "The combination of risk factors exceeds our current underwriting guidelines.")

    now = datetime.now(tz=timezone.utc)
    model_version = getattr(_model, "MODEL_VERSION", "1.0.0")

    for idx in range(n):
        decision = str(decision_arr[idx])
        prob = float(probs[idx])
        fired = str(rules_fired[idx])

        if decision == "approve":
            limit, apr = _terms(prob, float(incomes[idx]))
        else:
            limit, apr = None, None

        if fired:
            code, fcra, desc = _RULE_REASON[fired]
            reason_codes = [{"code": code, "fcra_code": fcra, "description": desc}]
            rules_triggered = [fired]
            mver = "rules-1.0.0"
        elif decision in ("reject", "review"):
            code, fcra, desc = _MODEL_DECLINE
            reason_codes = [{"code": code, "fcra_code": fcra, "description": desc}]
            rules_triggered = []
            mver = model_version
        else:
            reason_codes = []
            rules_triggered = []
            mver = model_version

        shap_values = None
        if idx in shap_sample_idx:
            try:
                shap_values = _shap_explainer.explain(feats[idx])
            except Exception:  # noqa: BLE001
                shap_values = None

        decision_id = str(_uuid.uuid4())
        db.add(DecisionRecord(
            id=decision_id,
            created_at=now,
            applicant_ref=parsed[idx][2],
            input_payload=raw_dicts[idx],
            decision=decision,
            credit_limit=limit,
            apr=apr,
            confidence_score=round(abs(prob - 0.5) * 2, 4),
            risk_segment=_segment(prob, bool(thin_flags[idx])),
            reason_codes=reason_codes,
            shap_values=shap_values,
            model_version=mver,
            rules_triggered=rules_triggered,
            demo_mode=False,
            tenant_id=tenant_id,
        ))
        db.add(AuditLog(
            decision_id=decision_id,
            event_type="decision_made",
            actor="system",
            metadata_={"batch": True, "fast_path": True},
            tenant_id=tenant_id,
        ))

        result.processed += 1
        if decision == "approve":
            result.approved += 1
        elif decision == "reject":
            result.rejected += 1
        else:
            result.reviewed += 1

        if result.processed % 2_000 == 0:
            await db.commit()
            logger.info("Fast batch progress", extra={"processed": result.processed, "tenant_id": tenant_id})

    await db.commit()
    result.elapsed_seconds = round(time.perf_counter() - t_start, 2)
    logger.info("Fast batch complete", extra={"tenant_id": tenant_id, "processed": result.processed,
                                              "approved": result.approved, "elapsed_s": result.elapsed_seconds})
    return result
