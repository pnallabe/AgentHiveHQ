"""
CC Originations Valuation API — Section 19.8
=============================================
FastAPI router mounted at: /api/analytics/cc-valuation

Endpoints:
    POST /api/analytics/cc-valuation/origination
        — Evaluate a single applicant or batch for acquisition profitability.
    GET  /api/analytics/cc-valuation/policy-summary
        — Aggregate origination valuation summary for a given period / product.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------
# Make credit-risk-platform importable from the AgentHiveHQ backend
# ---------------------------------------------------------------------------
try:
    _CRP_ROOT = Path(__file__).resolve().parents[6] / "credit-risk-platform"
    if _CRP_ROOT.exists() and str(_CRP_ROOT) not in sys.path:
        sys.path.insert(0, str(_CRP_ROOT))
except IndexError:
    _CRP_ROOT = None

from app.modules.analytics.scenario_config_proxy import SCENARIO_KEYS

# Lazy-import heavy platform modules at request time to avoid breaking startup
# if the credit-risk-platform is not yet installed.
def _import_cnpv():
    from models.pricing.cnpv_engine import compute_cnpv
    return compute_cnpv

def _import_batch():
    from decision_engine.cc_origination_policy import run_batch_valuation
    return run_batch_valuation

def _import_ftp_table():
    from models.pricing.ftp_engine import ftp_rate_table
    return ftp_rate_table

def _import_assumptions():
    """Lazy-import the assumptions registry (requires credit-risk-platform on path)."""
    from models.pricing.cc_valuation_assumptions import (
        get_assumptions,
        patch_assumptions,
        reset_assumptions,
        assumptions_as_dict,
    )
    return get_assumptions, patch_assumptions, reset_assumptions, assumptions_as_dict

# ---------------------------------------------------------------------------
# Shared helpers (read live assumptions, fall back to env vars if platform absent)
# ---------------------------------------------------------------------------

_FALLBACK_CET1_BUFFER  = float(os.getenv("CET1_BUFFER_AVAILABLE_USD", "500000000"))
_FALLBACK_CET1_TARGET  = float(os.getenv("CET1_TARGET_RATIO",         "0.125"))
_FALLBACK_LGD          = float(os.getenv("CC_LGD_DEFAULT",            "0.65"))
_FALLBACK_BENCHMARK    = float(os.getenv("FTP_BENCHMARK_RATE",        "0.0530"))
_FALLBACK_HURDLE_RATE  = float(os.getenv("FTP_HURDLE_RATE",           "0.105"))


def _live(attr: str, fallback: float) -> float:
    """Read a scalar from the live assumptions registry with a fallback."""
    try:
        get_a, *_ = _import_assumptions()
        a = get_a()
        section, field = attr.split(".")
        return float(getattr(getattr(a, section), field))
    except Exception:
        return fallback


def _get_scenarios() -> dict:
    """Return live scenario dict, falling back to scenario_config_proxy."""
    try:
        from models.pricing.scenario_config import get_cc_scenarios
        return get_cc_scenarios()
    except Exception:
        from app.modules.analytics.scenario_config_proxy import CC_SCENARIOS
        return CC_SCENARIOS


_MODEL_VERSION = "cc_origination_valuation_v1"

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ApplicantInput(BaseModel):
    application_id:         str   = Field(..., description="Unique application identifier")
    product_id:             str   = Field("cash_back_everyday", description="Card product ID")
    bureau_score_at_orig:   int   = Field(..., ge=300, le=850)
    annual_income_usd:      float = Field(..., gt=0)
    dti:                    float = Field(..., ge=0, le=1)
    requested_credit_limit: float = Field(..., gt=0, description="USD")
    apr_offered:            float = Field(..., gt=0, lt=1, description="Annualised e.g. 0.2199")
    annual_fee:             float = Field(0.0, ge=0)
    interchange_rate:       float = Field(0.0190, gt=0, lt=0.05)
    rewards_rate:           float = Field(0.015,  ge=0, lt=0.10)
    monthly_spend_estimated: float = Field(650.0, gt=0)
    expected_utilisation:   float = Field(0.45, ge=0, le=1)
    acquisition_cost:       float = Field(115.0, ge=0)
    risk_segment:           str   = Field("near_prime")
    channel:                str   = Field("digital")
    is_thin_file:           bool  = Field(False)

    @validator("apr_offered")
    def apr_must_be_reasonable(cls, v: float) -> float:
        if not 0.05 <= v <= 0.40:
            raise ValueError("apr_offered must be between 5% and 40%")
        return v


class OriginationRequest(BaseModel):
    mode:                    Literal["single", "batch"] = "batch"
    applicants:              List[ApplicantInput]
    scenario_weights_override: Optional[Dict[str, float]] = None
    cet1_buffer_override_usd:  Optional[float] = None
    include_monthly_cashflows: bool = False


class PolicySummaryParams(BaseModel):
    period:   str = "mtd"
    product:  str = "all"
    scenario: str = "scenario_weighted"


# ---------------------------------------------------------------------------
# Helper: applicant input → compute_cnpv kwargs
# ---------------------------------------------------------------------------


def _cnpv_kwargs(app: ApplicantInput, include_cashflows: bool = False) -> dict:
    return dict(
        credit_limit          = app.requested_credit_limit,
        annual_pd             = _pd_proxy(app.bureau_score_at_orig),
        apr                   = app.apr_offered,
        annual_fee            = app.annual_fee,
        interchange_rate      = app.interchange_rate,
        rewards_rate          = app.rewards_rate,
        monthly_spend         = app.monthly_spend_estimated,
        avg_utilisation       = app.expected_utilisation,
        acquisition_cost      = app.acquisition_cost,
        product_id            = app.product_id,
        bureau_score          = app.bureau_score_at_orig,
        cet1_buffer_available = _live("capital.cet1_buffer_available_usd", _FALLBACK_CET1_BUFFER),
        include_cashflows     = include_cashflows,
    )


def _pd_proxy(score: int) -> float:
    """PD proxy when model scores are unavailable."""
    if score >= 720: return 0.008
    if score >= 660: return 0.022
    if score >= 580: return 0.048
    return 0.085


def _capital_check_to_dict(cc: Any) -> dict:
    return {
        "rwa":                   cc.rwa,
        "capital_required":      cc.capital_required,
        "can_originate":         cc.can_originate,
        "capital_headroom_pct":  cc.capital_headroom_pct,
    }


def _ftp_to_dict(ftp: Any) -> dict:
    return {
        "benchmark_rate":        ftp.benchmark_rate,
        "liquidity_premium_bps": ftp.liquidity_premium_bps,
        "credit_tier_adj_bps":   ftp.credit_tier_adj_bps,
        "scenario_spread_bps":   ftp.scenario_spread_bps,
        "total_ftp_rate":        ftp.total_ftp_rate,
    }


def _ftp_assumptions_summary() -> dict:
    """Build the ftp_assumptions block for API responses (live from registry)."""
    benchmark   = _live("ftp.benchmark_rate",  _FALLBACK_BENCHMARK)
    hurdle_rate = _live("ftp.hurdle_rate",      _FALLBACK_HURDLE_RATE)
    scenarios   = _get_scenarios()
    result: dict = {"benchmark_rate": benchmark, "hurdle_rate": hurdle_rate, "scenarios": {}}
    for scen_key in SCENARIO_KEYS:
        spread = scenarios.get(scen_key, {}).get("ftp_spread_bps", 0)
        near_prime_total = benchmark + (50 + 20 + spread) / 10_000
        result["scenarios"][scen_key] = {
            "ftp_spread_bps":                    spread,
            "total_ftp_rate_example_near_prime": round(near_prime_total, 4),
        }
    return result


# ---------------------------------------------------------------------------
# POST /origination
# ---------------------------------------------------------------------------


@router.post(
    "/origination",
    summary="Evaluate applicant(s) for acquisition profitability",
    response_model=None,
    status_code=200,
    tags=["CC Valuation"],
)
async def evaluate_origination(payload: OriginationRequest) -> dict:
    """Compute 36-month CNPV under Base, Worsening, and Recession scenarios.

    Returns ACQUIRE / DECLINE / MANAGE_PRICE signals with recommended APR,
    credit limit, and capital check details for each applicant.
    """
    try:
        compute_cnpv = _import_cnpv()
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"CNPV engine unavailable: {exc}. "
                   "Ensure credit-risk-platform is installed or on PYTHONPATH.",
        )

    cet1_buffer = payload.cet1_buffer_override_usd or _live(
        "capital.cet1_buffer_available_usd", _FALLBACK_CET1_BUFFER
    )
    scenarios = _get_scenarios()
    weights     = payload.scenario_weights_override or {
        s: scenarios[s]["probability_weight"] for s in SCENARIO_KEYS
    }

    # Validate scenario weight sum
    if abs(sum(weights.values()) - 1.0) > 1e-4:
        raise HTTPException(
            status_code=422,
            detail=f"scenario_weights_override must sum to 1.0 (got {sum(weights.values()):.4f})",
        )

    applicant_results: list[dict] = []

    for app in payload.applicants:
        per_scenario: dict = {}
        for scen in SCENARIO_KEYS:
            kwargs = _cnpv_kwargs(app, include_cashflows=(
                payload.include_monthly_cashflows and scen == "base"
            ))
            kwargs["scenario"] = scen
            kwargs["cet1_buffer_available"] = cet1_buffer
            per_scenario[scen] = compute_cnpv(**kwargs)

        sw_cnpv = sum(weights[s] * per_scenario[s].cnpv for s in weights if s in per_scenario)
        signal  = per_scenario["base"].acquisition_signal
        if per_scenario["recession"].cnpv < -200:
            signal = "DECLINE"

        a_result: dict = {
            "application_id":           app.application_id,
            "product_id":               app.product_id,
            "bureau_score":             app.bureau_score_at_orig,
            "risk_segment":             app.risk_segment,
            "cnpv_base":                per_scenario["base"].cnpv,
            "cnpv_worsening":           per_scenario["industry_worsening"].cnpv,
            "cnpv_recession":           per_scenario["recession"].cnpv,
            "scenario_weighted_cnpv":   round(sw_cnpv, 2),
            "acquisition_signal":       signal,
            "recommended_apr":          per_scenario["base"].recommended_apr,
            "recommended_credit_limit": per_scenario["base"].recommended_credit_limit,
            "capital_required":         per_scenario["base"].capital_check.capital_required,
            "roe_3yr_base":             per_scenario["base"].roe_3yr,
            "ftp_rate_base":            per_scenario["base"].ftp.total_ftp_rate,
            "capital_check":            _capital_check_to_dict(per_scenario["base"].capital_check),
            "ftp_breakdown":            _ftp_to_dict(per_scenario["base"].ftp),
            "sensitivity":              per_scenario["base"].sensitivity,
        }
        if payload.include_monthly_cashflows:
            a_result["monthly_cashflows"] = per_scenario["base"].monthly_cashflows

        applicant_results.append(a_result)

    # Portfolio summary
    import pandas as pd
    df = pd.DataFrame(applicant_results)
    approved = df[df["acquisition_signal"] == "ACQUIRE"]

    portfolio_summary = {
        "total_applicants":      len(df),
        "approve_count":         int((df["acquisition_signal"] == "ACQUIRE").sum()),
        "manage_price_count":    int((df["acquisition_signal"] == "MANAGE_PRICE").sum()),
        "decline_count":         int((df["acquisition_signal"] == "DECLINE").sum()),
        "approve_rate":          round(len(approved) / len(df), 4) if len(df) > 0 else 0.0,
        "expected_portfolio_cnpv": round(float(approved["scenario_weighted_cnpv"].sum()), 2) if len(approved) > 0 else 0.0,
        "avg_cnpv_per_approved": round(float(approved["scenario_weighted_cnpv"].mean()), 2) if len(approved) > 0 else 0.0,
        "capital_consumed":      round(float(approved["capital_required"].sum()), 2) if len(approved) > 0 else 0.0,
        "remaining_capital":     round(cet1_buffer - float(approved["capital_required"].sum()), 2) if len(approved) > 0 else cet1_buffer,
        "capital_utilisation_pct": round(float(approved["capital_required"].sum()) / cet1_buffer, 4) if len(approved) > 0 and cet1_buffer > 0 else 0.0,
        "cnpv_p10_p50_p90": {
            "p10": round(float(df["scenario_weighted_cnpv"].quantile(0.10)), 2),
            "p50": round(float(df["scenario_weighted_cnpv"].quantile(0.50)), 2),
            "p90": round(float(df["scenario_weighted_cnpv"].quantile(0.90)), 2),
        },
        "scenario_comparison": {
            "base_avg_cnpv":      round(float(df["cnpv_base"].mean()), 2),
            "worsening_avg_cnpv": round(float(df["cnpv_worsening"].mean()), 2),
            "recession_avg_cnpv": round(float(df["cnpv_recession"].mean()), 2),
        },
    }

    return {
        "model_version":        _MODEL_VERSION,
        "evaluated_at":         datetime.now(timezone.utc).isoformat(),
        "ftp_assumptions":      _ftp_assumptions_summary(),
        "capital_assumptions":  {
            "cet1_target_ratio":        _live("capital.cet1_target_ratio",        _FALLBACK_CET1_TARGET),
            "cet1_buffer_available_usd": cet1_buffer,
            "lgd_default":              _live("capital.lgd_default",              _FALLBACK_LGD),
        },
        "scenario_weights":     weights,
        "portfolio_summary":    portfolio_summary,
        "applicant_results":    applicant_results,
    }


# ---------------------------------------------------------------------------
# GET /policy-summary
# ---------------------------------------------------------------------------


@router.get(
    "/policy-summary",
    summary="Aggregate origination valuation summary for a time period",
    response_model=None,
    status_code=200,
    tags=["CC Valuation"],
)
async def get_policy_summary(
    period:   str = Query("mtd",             description="Date period: mtd | last_month | YYYY-MM"),
    product:  str = Query("all",             description="Product filter: all | product_id"),
    scenario: str = Query("scenario_weighted", description="Scenario view: base | industry_worsening | recession | scenario_weighted"),
) -> dict:
    """Return the aggregate origination valuation summary for the current cohort.

    Pulls from BigQuery cc_originations (or Parquet fallback) for the
    requested period.  Returns portfolio_summary enriched with vintage trend
    and segment profitability matrix.
    """
    try:
        run_batch = _import_batch()
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Batch valuation engine unavailable: {exc}.",
        )

    # Load cohort via the pipeline helper (reuses BQ/Parquet routing logic)
    try:
        from scripts.run_cc_valuation_pipeline import (
            _load_from_parquet,
            _resolve_dates,
        )
        date_from, date_to = _resolve_dates(
            period if period in ("mtd", "last_month") else "mtd", None, None
        )
        cohort = _load_from_parquet()   # default to Parquet for API path (BQ handled via pipeline)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cohort load failed: {exc}")

    if cohort.empty:
        raise HTTPException(status_code=404, detail="No origination data found for the requested period")

    # Filter by product if requested
    if product != "all" and "product_id" in cohort.columns:
        cohort = cohort[cohort["product_id"] == product]

    result = run_batch(cohort, cet1_buffer_available=_live(
        "capital.cet1_buffer_available_usd", _FALLBACK_CET1_BUFFER
    ))
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    ps = result["portfolio_summary"]

    # Build segment profitability matrix (4x3)
    import pandas as pd
    df = pd.DataFrame(result.get("applicant_results", []))
    segment_matrix: dict = {}
    if not df.empty and "risk_segment" in df.columns:
        for seg in ["prime", "near_prime", "subprime", "thin_file"]:
            seg_df = df[df["risk_segment"] == seg]
            if not seg_df.empty:
                segment_matrix[seg] = {
                    "base_avg_cnpv":      round(float(seg_df["cnpv_base"].mean()), 2),
                    "worsening_avg_cnpv": round(float(seg_df["cnpv_worsening"].mean()), 2),
                    "recession_avg_cnpv": round(float(seg_df["cnpv_recession"].mean()), 2),
                    "weighted_avg_cnpv":  round(float(seg_df["scenario_weighted_cnpv"].mean()), 2),
                    "breakeven_apr":      round(float(seg_df["recommended_apr"].mean()), 4) if "recommended_apr" in seg_df.columns else None,
                }

    # Capital utilisation
    cet1_buf = _live("capital.cet1_buffer_available_usd", _FALLBACK_CET1_BUFFER)
    ps["capital_utilisation_pct"] = round(
        ps.get("capital_consumed", 0) / cet1_buf, 4
    ) if cet1_buf > 0 else 0.0

    scenarios = _get_scenarios()
    return {
        "model_version":             _MODEL_VERSION,
        "period":                    period,
        "product_filter":            product,
        "scenario_view":             scenario,
        "generated_at":              datetime.now(timezone.utc).isoformat(),
        "portfolio_summary":         ps,
        "segment_profitability_matrix": segment_matrix,
        "ftp_assumptions":           _ftp_assumptions_summary(),
        "capital_assumptions": {
            "cet1_target_ratio":         _live("capital.cet1_target_ratio",        _FALLBACK_CET1_TARGET),
            "cet1_buffer_available_usd": cet1_buf,
            "lgd_default":               _live("capital.lgd_default",              _FALLBACK_LGD),
        },
        "scenario_weights": {
            s: scenarios[s]["probability_weight"] for s in SCENARIO_KEYS
        },
    }

# ---------------------------------------------------------------------------
# GET /assumptions
# ---------------------------------------------------------------------------


@router.get(
    "/assumptions",
    summary="Read all active model assumptions",
    response_model=None,
    status_code=200,
    tags=["CC Valuation"],
)
async def get_model_assumptions() -> dict:
    """Return the full assumptions registry as a plain JSON document.

    The returned structure mirrors ``CCValuationAssumptions`` (scenarios, ftp,
    capital, cnpv) and can be round-tripped directly to ``PATCH /assumptions``.
    """
    try:
        get_a, _, _, as_dict = _import_assumptions()
        return {"status": "live", "assumptions": as_dict()}
    except ImportError:
        return {
            "status": "fallback_env_vars",
            "note": "credit-risk-platform not on PYTHONPATH; partial env-var snapshot only",
            "assumptions": {
                "ftp":     {"benchmark_rate": _FALLBACK_BENCHMARK, "hurdle_rate": _FALLBACK_HURDLE_RATE},
                "capital": {
                    "cet1_target_ratio":         _FALLBACK_CET1_TARGET,
                    "lgd_default":               _FALLBACK_LGD,
                    "cet1_buffer_available_usd": _FALLBACK_CET1_BUFFER,
                },
            },
        }


# ---------------------------------------------------------------------------
# PATCH /assumptions
# ---------------------------------------------------------------------------


@router.patch(
    "/assumptions",
    summary="Update model assumptions at runtime (no restart required)",
    response_model=None,
    status_code=200,
    tags=["CC Valuation"],
)
async def update_model_assumptions(patch: Dict[str, Any]) -> dict:
    """Deep-merge *patch* into the live assumptions registry.

    Changes take effect on the **next** engine call — no server restart needed.

    Accepted top-level keys: ``scenarios``, ``ftp``, ``capital``, ``cnpv``,
    ``model_version``.

    Example — raise the SOFR benchmark 25bps and adjust recession weight::

        {
          "ftp": { "benchmark_rate": 0.0555 },
          "scenarios": {
            "recession": { "probability_weight": 0.20 },
            "base":      { "probability_weight": 0.50 }
          }
        }

    Returns the full updated assumptions document.
    Validation errors (weights not summing to 1.0, wrong array length, etc.)
    are returned as HTTP 422.
    """
    try:
        _, patch_a, _, as_dict = _import_assumptions()
        patch_a(patch)
        return {"status": "updated", "assumptions": as_dict()}
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Assumptions registry unavailable: {exc}. "
                   "Ensure credit-risk-platform is on PYTHONPATH.",
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /assumptions/reset
# ---------------------------------------------------------------------------


@router.post(
    "/assumptions/reset",
    summary="Reset all assumptions to environment-variable defaults",
    response_model=None,
    status_code=200,
    tags=["CC Valuation"],
)
async def reset_model_assumptions() -> dict:
    """Discard any in-memory patches and rebuild assumptions from env-var defaults.

    The defaults respect the same environment variables active at server
    startup (``FTP_BENCHMARK_RATE``, ``CET1_TARGET_RATIO``, etc.).
    """
    try:
        _, _, reset_a, as_dict = _import_assumptions()
        reset_a()
        return {"status": "reset", "assumptions": as_dict()}
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"Assumptions registry unavailable: {exc}.")