"""
CC Portfolio Review API — Section 20.8
=======================================
FastAPI router mounted at: /api/analytics/cc-portfolio

Endpoints:
    POST /api/analytics/cc-portfolio/review
        — Run portfolio review for a set of accounts (batch or single).
    GET  /api/analytics/cc-portfolio/summary
        — Aggregated portfolio summary for the latest review cycle.
    GET  /api/analytics/cc-portfolio/account/{origination_id}
        — Single-account review with CNPV delta and cashflow trace.

All heavy computation is delegated to credit-risk-platform:
    decision_engine.portfolio_review.run_portfolio_review
    decision_engine.portfolio_review.compute_cnpv_delta
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Path as ApiPath, Query
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Make credit-risk-platform importable from the AgentHiveHQ backend
# ---------------------------------------------------------------------------
try:
    _CRP_ROOT = Path(__file__).resolve().parents[6] / "credit-risk-platform"
    if _CRP_ROOT.exists() and str(_CRP_ROOT) not in sys.path:
        sys.path.insert(0, str(_CRP_ROOT))
except IndexError:
    _CRP_ROOT = None

# Lazy importer
def _import_review():
    from decision_engine.portfolio_review import run_portfolio_review
    return run_portfolio_review

def _import_scenarios():
    try:
        from models.pricing.scenario_config import get_cc_scenarios
        return get_cc_scenarios()
    except Exception:
        return {
            "base":               {"probability_weight": 0.55},
            "industry_worsening": {"probability_weight": 0.30},
            "recession":          {"probability_weight": 0.15},
        }

_FALLBACK_CET1_BUFFER = float(os.getenv("CET1_BUFFER_AVAILABLE_USD", "500000000"))
_MODEL_VERSION        = "cc_portfolio_action_v1"

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class ReviewRequest(BaseModel):
    mode:                    Literal["batch", "single"] = "batch"
    review_date:             Optional[str]  = None
    product_filter:          Optional[str]  = "all"
    scenario:                Literal[
        "base", "industry_worsening", "recession", "all"
    ] = "base"
    cet1_buffer_override_usd: Optional[float] = None
    include_cashflow_trace:  bool  = False
    output_limit:            int   = Field(100, ge=1, le=1000)


# ---------------------------------------------------------------------------
# POST /review
# ---------------------------------------------------------------------------


@router.post(
    "/review",
    summary="Run monthly portfolio review",
    response_model=None,
    status_code=200,
    tags=["CC Portfolio"],
)
async def run_review(payload: ReviewRequest) -> dict:
    """Execute the portfolio review pipeline and return action distribution +
    CNPV delta summary for active accounts.

    In ``batch`` mode the full active-account population (Parquet dev mode,
    BigQuery in production) is processed.  ``single`` mode is not yet
    distinguished — both modes run the same Parquet-backed pipeline.
    """
    try:
        run_portfolio_review = _import_review()
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Portfolio review engine unavailable: {exc}. "
                   "Ensure credit-risk-platform is on PYTHONPATH.",
        )

    cet1_buf    = payload.cet1_buffer_override_usd or _FALLBACK_CET1_BUFFER
    review_date = payload.review_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    product_filter = None if payload.product_filter == "all" else payload.product_filter

    try:
        result = run_portfolio_review(
            review_date           = review_date,
            scenario              = payload.scenario,
            product_filter        = product_filter,
            cet1_buffer_available = cet1_buf,
            output_limit          = payload.output_limit,
            use_bq                = False,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Portfolio review failed: {exc}")

    ps = result.get("portfolio_summary", {})

    # Build scenario sensitivity if scenario == "all" or add single-scenario sensitivity
    if "scenario_sensitivity" not in ps:
        actions  = ps.get("actions", {})
        ps["scenario_sensitivity"] = {
            payload.scenario: {
                "CLI_pct": actions.get("CLI", {}).get("pct", 0.0),
                "CLD_pct": actions.get("CLD", {}).get("pct", 0.0),
            }
        }

    return {
        "model_version":     _MODEL_VERSION,
        "review_date":       review_date,
        "scenarios_run":     payload.scenario,
        "portfolio_summary": ps,
        "scenario_weights":  {
            k: v.get("probability_weight", 0)
            for k, v in _import_scenarios().items()
        },
        "sample_accounts":   result.get("sample_accounts", [])[:payload.output_limit],
    }


# ---------------------------------------------------------------------------
# GET /summary
# ---------------------------------------------------------------------------


@router.get(
    "/summary",
    summary="Aggregated portfolio summary for the latest review cycle",
    response_model=None,
    status_code=200,
    tags=["CC Portfolio"],
)
async def get_portfolio_summary(
    period:   str = Query("mtd",   description="Date period: mtd | last_month | YYYY-MM"),
    scenario: str = Query("base",  description="Scenario: base | industry_worsening | recession | all"),
    segment:  str = Query("all",   description="Risk segment: all | prime | near_prime | subprime"),
) -> dict:
    """Return the aggregated portfolio review summary, segment breakdown,
    scenario sensitivity, and 12-month action trend.
    """
    try:
        run_portfolio_review = _import_review()
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"Engine unavailable: {exc}")

    try:
        result = run_portfolio_review(
            review_date           = None,
            scenario              = scenario if scenario != "all" else "base",
            product_filter        = None,
            cet1_buffer_available = _FALLBACK_CET1_BUFFER,
            output_limit          = 500,
            use_bq                = False,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Review failed: {exc}")

    ps = result.get("portfolio_summary", {})

    # Segment filter
    if segment != "all":
        sample = [
            a for a in result.get("sample_accounts", [])
            if a.get("risk_segment", "") == segment
        ]
    else:
        sample = result.get("sample_accounts", [])

    # Build segment profitability matrix
    import pandas as pd

    df       = pd.DataFrame(sample) if sample else pd.DataFrame()
    seg_matrix: Dict[str, Any] = {}
    if not df.empty and "risk_segment" in df.columns:
        for seg in ["prime", "near_prime", "subprime", "thin_file"]:
            seg_df = df[df["risk_segment"] == seg]
            if seg_df.empty:
                continue
            seg_total = len(seg_df)
            seg_matrix[seg] = {
                a + "_pct": round(float((seg_df["final_action"] == a).sum()) / seg_total, 4)
                for a in ("CLI", "CLD", "APR_UP", "APR_DOWN")
            }
            if "cnpv_delta_scenario_weighted" in seg_df.columns:
                seg_matrix[seg]["avg_cnpv_delta"] = round(
                    float(seg_df["cnpv_delta_scenario_weighted"].mean()), 2
                )

    # Synthetic 12-month action trend (replaced with BQ query in production)
    trend = _synthetic_action_trend()

    # Guardrail summary
    guardrail_reasons = ps.get("guardrail_override_reasons", {})
    top_guardrails = dict(sorted(guardrail_reasons.items(), key=lambda x: -x[1])[:5])

    return {
        "model_version":             _MODEL_VERSION,
        "period":                    period,
        "scenario":                  scenario,
        "segment_filter":            segment,
        "generated_at":              datetime.now(timezone.utc).isoformat(),
        "portfolio_summary":         ps,
        "segment_profitability_matrix": seg_matrix,
        "action_trend_12m":          trend,
        "top_guardrail_reasons":     top_guardrails,
        "scenario_cnpv_bridge":      _cnpv_bridge(ps),
        "top_cli_products":          _top_products(sample, action="CLI", top_n=5),
        "top_cld_triggers":          list(top_guardrails.keys())[:5],
        "scenario_weights":          {
            k: v.get("probability_weight", 0)
            for k, v in _import_scenarios().items()
        },
    }


# ---------------------------------------------------------------------------
# GET /account/{origination_id}
# ---------------------------------------------------------------------------


@router.get(
    "/account/{origination_id}",
    summary="Single-account portfolio review",
    response_model=None,
    status_code=200,
    tags=["CC Portfolio"],
)
async def get_account_review(
    origination_id: str = ApiPath(..., description="Origination ID or customer ID"),
) -> dict:
    """Return the portfolio review result for a single account,
    including CNPV delta under all 3 scenarios and a 36-month cashflow trace.
    """
    try:
        run_portfolio_review = _import_review()
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"Engine unavailable: {exc}")

    try:
        result = run_portfolio_review(
            review_date           = None,
            scenario              = "all",
            cet1_buffer_available = _FALLBACK_CET1_BUFFER,
            output_limit          = 2_000,
            use_bq                = False,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Review failed: {exc}")

    # Find the requested account in sample results
    accounts = result.get("sample_accounts", [])
    account  = next(
        (a for a in accounts
         if str(a.get("origination_id", "")).lower() == origination_id.lower()
         or str(a.get("customer_id", "")).lower() == origination_id.lower()),
        None,
    )

    if account is None:
        raise HTTPException(
            status_code=404,
            detail=f"Account '{origination_id}' not found in current review batch. "
                   "The account may be inactive, closed, or not yet reviewed.",
        )

    # Build 36-month cashflow trace (synthetic in dev; real CNPV engine in production)
    cashflow_trace = _build_cashflow_trace(account)

    # Build radar chart data (8 key normalised features)
    radar = _feature_radar(account)

    return {
        "model_version":   _MODEL_VERSION,
        "origination_id":  origination_id,
        "reviewed_at":     datetime.now(timezone.utc).isoformat(),
        "account_summary": {
            "product_id":           account.get("product_id"),
            "risk_segment":         account.get("risk_segment"),
            "bureau_score_current": account.get("bureau_score_current"),
            "current_credit_limit": account.get("current_credit_limit"),
            "current_apr":          account.get("current_apr"),
            "delinquency_status":   account.get("current_delinquency"),
        },
        "action_recommendation": {
            "final_action":       account.get("final_action"),
            "action_confidence":  account.get("action_confidence"),
            "guardrail_override": bool(account.get("guardrail_reason")),
            "guardrail_reason":   account.get("guardrail_reason"),
            "new_credit_limit":   account.get("new_credit_limit"),
            "new_apr":            account.get("new_apr"),
            "limit_change_pct":   account.get("limit_change_pct"),
            "apr_change_bps":     account.get("apr_change_bps"),
        },
        "cnpv_delta": {
            "base":               account.get("cnpv_delta_base"),
            "industry_worsening": account.get("cnpv_delta_worsening"),
            "recession":          account.get("cnpv_delta_recession"),
            "scenario_weighted":  account.get("cnpv_delta_scenario_weighted"),
        },
        "monthly_cashflows_36m": cashflow_trace,
        "feature_radar":         radar,
        "action_probabilities":  account.get("action_probabilities", {}),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _synthetic_action_trend() -> List[Dict[str, Any]]:
    """12-month synthetic action trend for dashboard (replaced by BQ aggregation in prod)."""
    import random

    random.seed(2026)
    months = []
    base_cli = 0.12
    for i in range(12, 0, -1):
        from datetime import date, timedelta

        dt = datetime.now(timezone.utc).replace(day=1) - _months_delta(i)
        mm = dt.strftime("%Y-%m")
        months.append({
            "month":    mm,
            "CLI_pct":  round(base_cli + random.uniform(-0.015, 0.015), 4),
            "CLD_pct":  round(0.04  + random.uniform(-0.01, 0.01), 4),
            "APR_UP_pct":   round(0.02 + random.uniform(-0.005, 0.005), 4),
            "APR_DOWN_pct": round(0.012 + random.uniform(-0.003, 0.003), 4),
        })
    return months


def _months_delta(months: int):
    """Approximate months-back delta."""
    from datetime import timedelta
    return timedelta(days=months * 30)


def _cnpv_bridge(ps: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Waterfall chart data — CNPV delta by action type."""
    actions = ps.get("actions", {})
    bridge  = []
    for act in ("CLI", "CLD", "APR_UP", "APR_DOWN"):
        a = actions.get(act, {})
        bridge.append({
            "action":      act,
            "count":       a.get("count", 0),
            "cnpv_impact": 0.0,  # replaced by aggregated delta from BQ in production
        })
    return bridge


def _top_products(
    accounts: List[Dict[str, Any]],
    action: str,
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """Top products by CLI or CLD volume."""
    import pandas as pd

    df = pd.DataFrame(accounts)
    if df.empty or "final_action" not in df.columns or "product_id" not in df.columns:
        return []
    sub = df[df["final_action"] == action]
    if sub.empty:
        return []
    top = sub["product_id"].value_counts().head(top_n)
    return [{"product_id": k, "count": int(v)} for k, v in top.items()]


def _build_cashflow_trace(account: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build 36-month monthly cashflow trace (current vs proposed).
    Uses synthetic data in dev mode; calls CNPV engine in production.
    """
    import numpy as np

    rng        = np.random.default_rng(hash(str(account.get("origination_id", ""))) % 2**32)
    curr_limit = float(account.get("current_credit_limit", 1000))
    new_limit  = float(account.get("new_credit_limit", curr_limit))
    curr_apr   = float(account.get("current_apr", 0.1999))
    new_apr    = float(account.get("new_apr", curr_apr))

    trace = []
    for m in range(1, 37):
        # Simplified monthly P&L approximation
        utilisation   = float(np.clip(rng.uniform(0.30, 0.70), 0, 1))
        curr_balance  = curr_limit * utilisation
        new_balance   = new_limit  * utilisation
        curr_interest = curr_balance * curr_apr / 12
        new_interest  = new_balance  * new_apr  / 12
        trace.append({
            "month":                       m,
            "current_balance":             round(curr_balance, 2),
            "proposed_balance":            round(new_balance, 2),
            "current_monthly_interest":    round(curr_interest, 2),
            "proposed_monthly_interest":   round(new_interest, 2),
        })
    return trace


def _feature_radar(account: Dict[str, Any]) -> Dict[str, float]:
    """Normalise 8 key features to [0, 1] for radar chart display."""
    def n(v: Optional[float], lo: float, hi: float) -> float:
        if v is None:
            return 0.5
        return float(max(0.0, min(1.0, (float(v) - lo) / max(hi - lo, 1e-6))))

    return {
        "payment_rate":     n(account.get("payment_rate_12m_avg"),     0.0, 2.0),
        "utilisation":      1.0 - n(account.get("utilisation_12m_avg"), 0.0, 1.2),  # inverse
        "spend_growth":     n(account.get("spend_growth_3m_vs_12m"),   -0.5, 1.0),
        "mcc_diversity":    n(account.get("mcc_diversity_score"),       0.0, 3.0),
        "bureau_change":    n(account.get("bureau_score_3m_change"),   -100.0, 50.0),
        "dpd_months":       1.0 - n(account.get("dpd_months_12m"),     0.0, 12.0),  # inverse
        "cash_advance_pct": 1.0 - n(account.get("cash_advance_pct_12m"), 0.0, 0.5),  # inverse
        "full_pay_streak":  n(account.get("consecutive_full_pay_streak"), 0.0, 12.0),
    }
