"""Governance service — decision analytics, bias monitoring, and compliance metrics.

Story 4.2: GET /api/governance/dashboard
Story 4.3: GET /api/governance/bias-report

All queries exclude demo_mode=True records from metrics.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.db_models import DecisionRecord
from app.shared import loan_portfolio

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
_DISCLAIMER = (
    "This report is for internal model monitoring only. "
    "Approval decisions are based on financial factors only. "
    "Not for external reporting or distribution."
)

_PERIOD_DAYS: dict[str, Optional[int]] = {
    "last_7_days":  7,
    "last_30_days": 30,
    "last_90_days": 90,
    "all_time":     None,
}


def _period_cutoff(period: str) -> Optional[datetime]:
    days = _PERIOD_DAYS.get(period)
    if days is None:
        return None
    return datetime.now(tz=timezone.utc) - timedelta(days=days)


class GovernanceDashboardService:
    """Aggregates decision data for the governance dashboard."""

    # ── Dashboard ─────────────────────────────────────────────────────────────

    async def get(self, db: AsyncSession, period: str = "last_30_days") -> dict[str, Any]:
        """Return aggregated governance metrics for the given period."""
        cutoff = _period_cutoff(period)

        # Base filter: exclude demo records; apply period window.
        base = select(DecisionRecord).where(DecisionRecord.demo_mode == False)  # noqa: E712
        if cutoff:
            base = base.where(DecisionRecord.created_at >= cutoff)

        # ── Total decisions ────────────────────────────────────────────────────
        total_stmt = select(func.count()).select_from(base.subquery())
        total: int = (await db.execute(total_stmt)).scalar_one() or 0

        if total == 0:
            return self._empty_dashboard(period)

        # ── Approval rate ──────────────────────────────────────────────────────
        approved_stmt = select(func.count()).select_from(
            base.where(DecisionRecord.decision == "approve").subquery()
        )
        approved: int = (await db.execute(approved_stmt)).scalar_one() or 0
        approval_rate = round(approved / total, 4) if total else 0.0

        # ── Average credit limit (approved only) ──────────────────────────────
        avg_limit_stmt = select(func.avg(DecisionRecord.credit_limit)).select_from(
            base.where(
                DecisionRecord.decision == "approve",
                DecisionRecord.credit_limit.is_not(None),
            ).subquery()
        )
        avg_credit_limit = float((await db.execute(avg_limit_stmt)).scalar_one() or 0.0)

        # ── Average APR (approved only) ────────────────────────────────────────
        avg_apr_stmt = select(func.avg(DecisionRecord.apr)).select_from(
            base.where(
                DecisionRecord.decision == "approve",
                DecisionRecord.apr.is_not(None),
            ).subquery()
        )
        avg_apr = float((await db.execute(avg_apr_stmt)).scalar_one() or 0.0)

        # ── Decisions by segment ───────────────────────────────────────────────
        segment_stmt = (
            select(DecisionRecord.risk_segment, func.count().label("cnt"))
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        if cutoff:
            segment_stmt = segment_stmt.where(DecisionRecord.created_at >= cutoff)
        segment_stmt = segment_stmt.group_by(DecisionRecord.risk_segment)
        segment_rows = (await db.execute(segment_stmt)).all()
        decisions_by_segment = {r[0]: r[1] for r in segment_rows}

        # ── Approval rate by segment ───────────────────────────────────────────
        seg_approve_stmt = (
            select(
                DecisionRecord.risk_segment,
                func.count().label("total"),
                func.sum(
                    case((DecisionRecord.decision == "approve", 1), else_=0)
                ).label("approved"),
            )
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        if cutoff:
            seg_approve_stmt = seg_approve_stmt.where(DecisionRecord.created_at >= cutoff)
        seg_approve_stmt = seg_approve_stmt.group_by(DecisionRecord.risk_segment)
        seg_approve_rows = (await db.execute(seg_approve_stmt)).all()
        approval_rate_by_segment = {
            r[0]: round(r[2] / r[1], 4) if r[1] > 0 else 0.0
            for r in seg_approve_rows
        }

        # ── Top reason codes (from JSON array column) ─────────────────────────
        # Load records and aggregate in Python (avoids JSON-path dialect differences).
        records_stmt = (
            select(DecisionRecord.reason_codes, DecisionRecord.decision)
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        if cutoff:
            records_stmt = records_stmt.where(DecisionRecord.created_at >= cutoff)
        records_result = await db.execute(records_stmt)
        code_counts: dict[str, int] = {}
        rules_counts: dict[str, int] = {}

        # We need rules_triggered too — fetch full records.
        full_stmt = (
            select(DecisionRecord.reason_codes, DecisionRecord.rules_triggered)
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        if cutoff:
            full_stmt = full_stmt.where(DecisionRecord.created_at >= cutoff)
        full_rows = (await db.execute(full_stmt)).all()

        for reason_codes, rules_triggered in full_rows:
            if reason_codes:
                for rc in reason_codes:
                    code = rc.get("code", rc) if isinstance(rc, dict) else str(rc)
                    code_counts[code] = code_counts.get(code, 0) + 1
            if rules_triggered:
                for rule in (rules_triggered if isinstance(rules_triggered, list) else []):
                    rules_counts[rule] = rules_counts.get(rule, 0) + 1

        top_reason_codes = sorted(
            [{"code": k, "count": v, "pct": round(v / total, 4)} for k, v in code_counts.items()],
            key=lambda x: x["count"],
            reverse=True,
        )[:5]

        # ── Approval rate by day (sparkline) ──────────────────────────────────
        # SQLite-compatible date aggregation.
        day_stmt = (
            select(
                func.date(DecisionRecord.created_at).label("day"),
                func.count().label("total"),
                func.sum(
                    case((DecisionRecord.decision == "approve", 1), else_=0)
                ).label("approved"),
            )
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        if cutoff:
            day_stmt = day_stmt.where(DecisionRecord.created_at >= cutoff)
        day_stmt = day_stmt.group_by(text("day")).order_by(text("day"))
        day_rows = (await db.execute(day_stmt)).all()
        approval_rate_by_day = [
            {
                "date":  str(r[0]),
                "count": r[1],
                "rate":  round(r[2] / r[1], 4) if r[1] > 0 else 0.0,
            }
            for r in day_rows
        ]

        # ── Freddie Mac portfolio benchmarks (non-blocking) ──────────────────
        portfolio_benchmarks: dict | None = None
        try:
            portfolio_benchmarks = await loan_portfolio.get_population_benchmarks()
        except Exception as _bq_exc:
            logger.debug("portfolio benchmarks unavailable", extra={"error": str(_bq_exc)})

        return {
            "period":                    period,
            "total_decisions":           total,
            "approval_rate":             approval_rate,
            "average_credit_limit":      round(avg_credit_limit, 2),
            "average_apr":               round(avg_apr, 2),
            "decisions_by_segment":      decisions_by_segment,
            "approval_rate_by_segment":  approval_rate_by_segment,
            "rules_triggered_frequency": rules_counts,
            "top_reason_codes":          top_reason_codes,
            "approval_rate_by_day":      approval_rate_by_day,
            "portfolio_benchmarks":      portfolio_benchmarks,
            # Sparkline trend: approvals + rejections per day for the period
            "trend": [
                {
                    "date":        str(r[0]),
                    "approvals":   int(r[2]),
                    "rejections":  int(r[1]) - int(r[2]),
                }
                for r in day_rows
            ],
        }

    # ── Bias report ───────────────────────────────────────────────────────────

    async def bias_report(self, db: AsyncSession) -> dict[str, Any]:
        """Compute adverse impact ratio across income bands (four-fifths rule).

        Income bands:
            0: < $25,000
            1: $25,000 – $50,000
            2: $50,000 – $100,000
            3: > $100,000

        Income is read from ``input_payload.income`` (JSON column).
        """
        stmt = (
            select(DecisionRecord.input_payload, DecisionRecord.decision)
            .where(DecisionRecord.demo_mode == False)  # noqa: E712
        )
        rows = (await db.execute(stmt)).all()

        bands: dict[str, dict[str, int]] = {
            "band_0_under_25k":  {"total": 0, "approved": 0},
            "band_1_25k_50k":    {"total": 0, "approved": 0},
            "band_2_50k_100k":   {"total": 0, "approved": 0},
            "band_3_over_100k":  {"total": 0, "approved": 0},
        }

        for input_payload, decision in rows:
            income = input_payload.get("income", 0) if isinstance(input_payload, dict) else 0
            if income < 25_000:
                band = "band_0_under_25k"
            elif income < 50_000:
                band = "band_1_25k_50k"
            elif income < 100_000:
                band = "band_2_50k_100k"
            else:
                band = "band_3_over_100k"

            bands[band]["total"] += 1
            if decision == "approve":
                bands[band]["approved"] += 1

        # Compute per-band approval rates.
        income_band_analysis = {
            k: {
                "total":    v["total"],
                "approved": v["approved"],
                "rate":     round(v["approved"] / v["total"], 4) if v["total"] > 0 else 0.0,
            }
            for k, v in bands.items()
        }

        rates = [v["rate"] for v in income_band_analysis.values() if v["total"] > 0]
        if len(rates) < 2:
            # Insufficient data — return safe defaults.
            adverse_impact_ratio = 1.0
            disparate_impact_flag = False
        else:
            lowest  = min(rates)
            highest = max(rates)
            adverse_impact_ratio = round(lowest / highest, 4) if highest > 0 else 1.0
            disparate_impact_flag = adverse_impact_ratio < 0.80

        return {
            "disclaimer":              _DISCLAIMER,
            "income_band_analysis":    income_band_analysis,
            "adverse_impact_ratio":    adverse_impact_ratio,
            "disparate_impact_flag":   disparate_impact_flag,
            "disparate_impact_threshold": 0.80,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _empty_dashboard(period: str) -> dict[str, Any]:
        return {
            "period":                    period,
            "total_decisions":           0,
            "approval_rate":             0.0,
            "average_credit_limit":      0.0,
            "average_apr":               0.0,
            "decisions_by_segment":      {},
            "approval_rate_by_segment":  {},
            "rules_triggered_frequency": {},
            "top_reason_codes":          [],
            "approval_rate_by_day":      [],
            "portfolio_benchmarks":      None,
            "trend":                     [],
        }
