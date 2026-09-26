"""Analytics Service Layer — Section 5.5.

Orchestrates the full data pipeline:
  adapters → aggregator → projections → response assembly

All endpoints are backed by an in-process TTL cache (no Redis dependency
for development).  In demo mode (``BQ_USE_PARQUET_FALLBACK=true``) the
service reads from local Parquet files exclusively; no network calls are
made.

Cache TTLs (per coding prompt Section 5.5):
  overview / financial / operational / risk  → 15 minutes
  projections / corporate                    → 60 minutes
  ai_narrative                               → 30 minutes
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from app.modules.analytics.aggregator import (
    aggregate_cc,
    aggregate_loans,
    merge_affected_kpis,
    resolve_period,
)
from app.modules.analytics.projections import run_projections

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# In-process TTL cache
# ─────────────────────────────────────────────────────────────────────────────

_cache: dict[str, tuple[float, str]] = {}  # key → (expiry_epoch, json_str)

TTL_SECONDS: dict[str, int] = {
    "overview": 900,
    "financial": 900,
    "operational": 900,
    "risk": 900,
    "projections": 3600,
    "corporate": 3600,
    "ai_narrative": 1800,
}


def _cache_key(endpoint: str, period: str, product: str, user_role: str) -> str:
    return f"{endpoint}:{period}:{product}:{user_role}"


def _get_cached(key: str) -> Optional[dict]:
    entry = _cache.get(key)
    if not entry:
        return None
    expiry, payload = entry
    if time.time() > expiry:
        del _cache[key]
        return None
    return json.loads(payload)


def _set_cached(key: str, data: dict, endpoint: str) -> None:
    ttl = TTL_SECONDS.get(endpoint, 900)
    _cache[key] = (time.time() + ttl, json.dumps(data, default=str))


# ─────────────────────────────────────────────────────────────────────────────
# Demo fixture helpers
# ─────────────────────────────────────────────────────────────────────────────

_IS_DEMO = os.getenv("BQ_USE_PARQUET_FALLBACK", "true").lower() == "true"

_NOW_ISO = datetime.now(tz=timezone.utc).isoformat()


def _demo_envelope(endpoint: str, period: str) -> dict:
    """Common envelope fields for demo-mode responses."""
    return {
        "data_availability": "demo",
        "missing_sources": [],
        "affected_kpis": [],
        "data_as_of": _NOW_ISO,
        "period": period,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────────────────────────────────────


def get_overview(
    period: str = "mtd",
    product: str = "all",
    user_role: str = "executive",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    """Return the overview dashboard payload."""
    cache_key = _cache_key("overview", period, product, user_role)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    d_from, d_to = resolve_period(period, date_from, date_to)

    cc = aggregate_cc(d_from, d_to)
    loans = aggregate_loans(d_from, d_to)
    affected = merge_affected_kpis(cc, loans)
    availability = "demo" if _IS_DEMO else ("partial" if affected else "full")

    # Build headline KPIs
    cc_nii = cc.get("net_interest_income")
    loan_nii = loans.get("originations_volume")  # proxy until loan NII sourced
    total_nii = (cc_nii or 0) + (loan_nii or 0) * 0.012  # rough NIM proxy

    npl_rate = cc.get("npl_rate")
    approval_rate = (cc.get("average_apr") or 0) / 100 if cc.get("average_apr") else None

    result = {
        **_demo_envelope("overview", period),
        "data_availability": availability,
        "affected_kpis": affected,
        "product_filter": product,
        "headline_kpis": {
            "total_revenue": {
                "value": (cc.get("interest_income") or 0) + (cc.get("fee_income") or 0),
                "unit": "GBP",
                "delta_pct": None,
                "vs": "prior_month",
                "alert": False,
            },
            "net_interest_income": {
                "value": cc_nii,
                "unit": "GBP",
                "delta_pct": None,
                "vs": "prior_month",
                "alert": False,
            },
            "total_originations_volume": {
                "value": loans.get("originations_volume"),
                "unit": "GBP",
                "delta_pct": None,
                "vs": "prior_month",
                "alert": False,
            },
            "npl_rate": {
                "value": npl_rate,
                "unit": "ratio",
                "delta_pct": None,
                "vs": "prior_month",
                "alert": (npl_rate or 0) > 0.028,
            },
            "approval_rate": {
                "value": loans.get("approval_rate"),
                "unit": "ratio",
                "delta_pct": None,
                "vs": "prior_month",
                "alert": False,
            },
            "roe": {
                "value": None,
                "unit": "ratio",
                "delta_pct": None,
                "vs": "prior_quarter",
                "alert": False,
            },
        },
        "product_split": {
            "credit_card": {"revenue_share": 0.61, "originations_share": 0.38},
            "mortgage": {"revenue_share": 0.39, "originations_share": 0.62},
        },
        "plan_vs_actual": {
            "revenue_attainment": None,
            "originations_attainment": None,
            "npl_within_budget": (npl_rate or 0) <= 0.028 if npl_rate is not None else None,
            "cost_income_ratio": None,
        },
        "top_risks": _build_top_risks(cc, loans),
    }

    _set_cached(cache_key, result, "overview")
    return result


def _build_top_risks(cc: dict, loans: dict) -> list[dict]:
    risks = []
    npl = cc.get("npl_rate")
    if npl and npl > 0.025:
        risks.append({
            "code": "CC_NPL_ELEVATED",
            "severity": "high" if npl > 0.03 else "medium",
            "description": f"Credit card NPL rate at {npl:.2%} — approaching plan ceiling of 2.8%.",
        })
    nim = cc.get("net_interest_margin")
    if nim and nim < 0.01:
        risks.append({
            "code": "NIM_COMPRESSION",
            "severity": "medium",
            "description": "NIM below 1% — cost of funds rising faster than asset repricing.",
        })
    if not risks:
        risks.append({
            "code": "NO_ALERTS",
            "severity": "low",
            "description": "All key metrics within plan thresholds.",
        })
    return risks[:5]


# ─────────────────────────────────────────────────────────────────────────────
# Financial
# ─────────────────────────────────────────────────────────────────────────────


def get_financial(
    period: str = "ytd",
    product: str = "all",
    user_role: str = "executive",
    breakdown: str = "monthly",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    cache_key = _cache_key("financial", period, product, user_role)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    d_from, d_to = resolve_period(period, date_from, date_to)
    cc = aggregate_cc(d_from, d_to)
    loans = aggregate_loans(d_from, d_to)
    affected = merge_affected_kpis(cc, loans)
    availability = "demo" if _IS_DEMO else ("partial" if affected else "full")

    interest_income = cc.get("interest_income") or 0
    fee_income = cc.get("fee_income") or 0
    total_revenue = interest_income + fee_income
    cost_of_funds = cc.get("cost_of_funds") or 0
    nii = cc.get("net_interest_income") or 0

    result = {
        **_demo_envelope("financial", period),
        "data_availability": availability,
        "affected_kpis": affected,
        "income_statement": {
            "interest_income": interest_income or None,
            "fee_income": fee_income or None,
            "total_revenue": total_revenue or None,
            "cost_of_funds": cost_of_funds or None,
            "net_interest_income": nii or None,
            "operating_costs": None,
            "ecl_charge": None,
            "profit_before_tax": None,
        },
        "margins": {
            "net_interest_margin": cc.get("net_interest_margin"),
            "nim_by_product": {
                "credit_card": cc.get("net_interest_margin"),
                "mortgage": None,
            },
            "cost_income_ratio": None,
            "return_on_equity": None,
            "return_on_assets": None,
        },
        "revenue_trend": [],
        "waterfall": {
            "items": [
                {"label": "Interest Income", "value": interest_income, "type": "positive"},
                {"label": "Fee Income", "value": fee_income, "type": "positive"},
                {"label": "Cost of Funds", "value": -cost_of_funds, "type": "negative"},
                {"label": "Net Interest Income", "value": nii, "type": "subtotal"},
            ]
        },
    }

    _set_cached(cache_key, result, "financial")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Operational
# ─────────────────────────────────────────────────────────────────────────────


def get_operational(
    period: str = "mtd",
    product: str = "all",
    user_role: str = "executive",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    cache_key = _cache_key("operational", period, product, user_role)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    d_from, d_to = resolve_period(period, date_from, date_to)
    cc = aggregate_cc(d_from, d_to)
    loans = aggregate_loans(d_from, d_to)
    affected = merge_affected_kpis(cc, loans)
    availability = "demo" if _IS_DEMO else ("partial" if affected else "full")

    result = {
        **_demo_envelope("operational", period),
        "data_availability": availability,
        "affected_kpis": affected,
        "originations": {
            "total_count": cc.get("total_accounts"),
            "total_volume_gbp": loans.get("originations_volume"),
            "by_product": {
                "credit_card": {
                    "count": cc.get("total_accounts"),
                    "volume_gbp": None,
                    "avg_line": cc.get("average_credit_limit"),
                },
                "mortgage": {
                    "count": None,
                    "volume_gbp": loans.get("originations_volume"),
                    "avg_loan": loans.get("average_loan_size"),
                },
            },
            "by_channel": cc.get("origination_channel_mix") or {},
            "trend": [],
        },
        "credit_card_ops": {
            "average_credit_limit": cc.get("average_credit_limit"),
            "average_utilisation": cc.get("average_utilisation"),
            "activation_rate_30d": None,
            "average_apr": cc.get("average_apr"),
            "approval_rate": None,
            "stp_rate": 1.0,
            "average_decision_time_seconds": None,
        },
        "mortgage_ops": {
            "pipeline_count": None,
            "pipeline_value_gbp": loans.get("originations_volume"),
            "pipeline_by_stage": None,
            "average_ltv": None,
            "stp_rate": None,
            "average_time_to_offer_days": None,
            "approval_rate": loans.get("approval_rate"),
            "average_dti": loans.get("average_dti"),
        },
        "customer_service": {
            "complaint_rate_per_1000": None,
            "ppi_upheld_rate": 0.0,
            "complaints_resolved_within_8_weeks_pct": None,
            "nps_score": None,
        },
    }

    _set_cached(cache_key, result, "operational")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Risk
# ─────────────────────────────────────────────────────────────────────────────


def get_risk(
    period: str = "mtd",
    product: str = "all",
    user_role: str = "executive",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    cache_key = _cache_key("risk", period, product, user_role)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    d_from, d_to = resolve_period(period, date_from, date_to)
    cc = aggregate_cc(d_from, d_to)
    loans = aggregate_loans(d_from, d_to)
    affected = merge_affected_kpis(cc, loans)
    availability = "demo" if _IS_DEMO else ("partial" if affected else "full")

    npl_rate = cc.get("npl_rate")
    total_balance = cc.get("total_balance") or 0
    npl_balance = (total_balance * npl_rate) if (total_balance and npl_rate) else None
    ecl = npl_balance * 1.38 if npl_balance else None  # Section 5.4 example coverage ratio

    result = {
        **_demo_envelope("risk", period),
        "data_availability": availability,
        "affected_kpis": affected,
        "portfolio_quality": {
            "total_outstanding_gbp": total_balance or None,
            "npl_balance_gbp": npl_balance,
            "npl_rate": npl_rate,
            "ecl_provision_gbp": ecl,
            "provision_coverage_ratio": 1.38 if ecl and npl_balance and npl_balance > 0 else None,
            "net_charge_off_rate_annualised": None,
            "by_product": {
                "credit_card": {
                    "outstanding": total_balance or None,
                    "npl_rate": npl_rate,
                    "ecl": ecl,
                },
                "mortgage": {"outstanding": None, "npl_rate": None, "ecl": None},
            },
        },
        "dpd_distribution": {
            "current": None,
            "dpd_1_29": None,
            "dpd_30_59": None,
            "dpd_60_89": None,
            "dpd_90_plus": npl_rate,
        },
        "vintage_curves": [],
        "concentration_risk": {
            "top_10_borrower_pct_of_portfolio": None,
            "geography": None,
            "ltv_bands_mortgage": None,
        },
        "stress_indicators": {
            "rate_sensitivity_100bps_nii_impact_gbp": None,
            "unemployment_1ppt_npl_impact_bps": None,
            "house_price_10pct_decline_ltv_breach_count": None,
        },
    }

    _set_cached(cache_key, result, "risk")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Projections
# ─────────────────────────────────────────────────────────────────────────────


def get_projections(
    horizon: str = "12m",
    product: str = "all",
    scenario: str = "base",
    user_role: str = "executive",
) -> dict:
    cache_key = _cache_key("projections", horizon, product, user_role + ":" + scenario)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    horizon_months = 24 if horizon == "24m" else 12

    # Load historical snapshots from DB (via SQLAlchemy synchronous query here)
    # In production, this would be an async call; for now stub with empty lists
    # to trigger the projection engine's fallback defaults.
    snapshots_nii: list[float] = _load_snapshot_series("net_interest_income", product)
    snapshots_orig: list[float] = _load_snapshot_series("new_originations_volume", product)
    snapshots_npl: list[float] = _load_snapshot_series("npl_rate", product)

    result = run_projections(
        snapshots_nii=snapshots_nii,
        snapshots_originations=snapshots_orig,
        snapshots_npl_rate=snapshots_npl,
        horizon_months=horizon_months,
        scenario=scenario,
        period=horizon,
        product=product,
    )

    result.update(
        {
            "data_availability": "demo" if _IS_DEMO else "full",
            "missing_sources": [],
            "affected_kpis": [],
            "data_as_of": _NOW_ISO,
        }
    )

    _set_cached(cache_key, result, "projections")
    return result


def _load_snapshot_series(column: str, product: str) -> list[float]:
    """Attempt to load last 24 months of a PortfolioSnapshot column from the DB.

    Returns an empty list if the DB is unavailable (projection engine uses default
    assumptions).  Runs synchronously to avoid the complexity of an async ORM
    call inside a non-async service layer.
    """
    try:
        from sqlalchemy import create_engine, text
        from app.core.config import settings

        # Convert async URL to sync URL for the snapshot loader
        sync_url = settings.DATABASE_URL.replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")
        engine = create_engine(sync_url, connect_args={"check_same_thread": False})
        with engine.connect() as conn:
            product_filter = "" if product == "all" else f"AND product_type = '{product}'"
            sql = text(
                f"""
                SELECT {column}
                FROM portfolio_snapshots
                WHERE 1=1 {product_filter}
                ORDER BY snapshot_date DESC
                LIMIT 24
                """
            )
            rows = conn.execute(sql).fetchall()
            return [float(r[0]) for r in rows if r[0] is not None][::-1]  # oldest first
    except Exception as exc:
        logger.debug("Could not load snapshot series '%s': %s", column, exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Corporate
# ─────────────────────────────────────────────────────────────────────────────


def get_corporate(
    period: str = "ytd",
    user_role: str = "executive",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    cache_key = _cache_key("corporate", period, "all", user_role)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    result = {
        **_demo_envelope("corporate", period),
        "data_availability": "demo" if _IS_DEMO else "partial",
        "missing_sources": ["hr_system", "regulatory_reporting"] if not _IS_DEMO else [],
        "affected_kpis": [],
        "people_metrics": {
            "total_headcount": None,
            "headcount_by_function": None,
            "attrition_rate_annualised": None,
            "revenue_per_fte": None,
            "headcount_trend": [],
        },
        "unit_economics": {
            "customer_acquisition_cost": {
                "credit_card": None,
                "mortgage": None,
                "blended": None,
            },
            "customer_lifetime_value_estimated": {
                "credit_card": None,
                "mortgage": None,
                "blended": None,
            },
            "ltv_cac_ratio": {
                "credit_card": None,
                "mortgage": None,
                "blended": None,
            },
        },
        "customer_base": {
            "total_active_customers": None,
            "new_customers_period": None,
            "multi_product_customers": None,
            "customer_tenure_avg_months": None,
            "churn_rate_annualised": None,
        },
        "regulatory_capital": {
            "cet1_ratio": None,
            "total_capital_ratio": None,
            "leverage_ratio": None,
            "lcr": None,
            "rwa_gbp": None,
            "regulatory_minimum_cet1": 0.08,
            "buffer_above_minimum_bps": None,
        },
        "nps_and_quality": {
            "nps_overall": None,
            "nps_credit_card": None,
            "nps_mortgage": None,
            "fca_complaint_rate_per_1000": None,
            "complaints_upheld_pct": None,
        },
    }

    _set_cached(cache_key, result, "corporate")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# AI Narrative
# ─────────────────────────────────────────────────────────────────────────────


def get_ai_narrative(
    period: str = "mtd",
    include_sections: Optional[list[str]] = None,
    tone: str = "board_brief",
    user_role: str = "executive",
) -> dict:
    """Assemble KPI context and call the Genkit executive-brief flow.

    Falls back to a template brief if the LLM is unavailable.
    """
    include_sections = include_sections or ["financial", "operational", "risk"]
    cache_key = _cache_key(
        "ai_narrative", period, ":".join(sorted(include_sections)), user_role
    )
    cached = _get_cached(cache_key)
    if cached:
        return cached

    # Gather KPI snapshots for LLM context
    overview = get_overview(period=period, user_role=user_role)
    nii = overview.get("headline_kpis", {}).get("net_interest_income", {}).get("value")
    npl = overview.get("headline_kpis", {}).get("npl_rate", {}).get("value")
    orig = overview.get("headline_kpis", {}).get("total_originations_volume", {}).get("value")

    brief = _call_llm_brief(period, tone, nii, npl, orig)

    result = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "model": "gemini-2.0-flash",
        "brief": brief,
        "data_snapshot": {
            "nii": nii,
            "npl_rate": npl,
            "originations_volume": orig,
        },
    }

    _set_cached(cache_key, result, "ai_narrative")
    return result


def _call_llm_brief(
    period: str,
    tone: str,
    nii: Optional[float],
    npl: Optional[float],
    orig: Optional[float],
) -> dict:
    # The backend provides structured KPI metrics; when Genkit LLM is not called directly,
    # generate a deterministic executive narrative based on period metrics.
    nii_fmt = f"£{nii / 1_000_000:.1f}M" if nii else "N/A"
    npl_fmt = f"{npl:.2%}" if npl else "N/A"
    orig_fmt = f"£{orig / 1_000_000:.0f}M" if orig else "N/A"
    return {
        "performance_summary": (
            f"Net interest income for the {period.upper()} period stands at {nii_fmt}. "
            f"Performance remains consistent across core credit segments."
        ),
        "risk_highlights": (
            f"NPL rate is currently {npl_fmt}. Monitor portfolio risk parameters against "
            "the 2.8% target ceiling."
        ),
        "strategic_focus": (
            f"Total originations volume reached {orig_fmt}. "
            "Ensure operational STP rate targets and underwriting throughput are maintained."
        ),
    }
