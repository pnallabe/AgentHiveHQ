"""Analytics Projections Engine — Section 5.4 (projections endpoint).

Methodology (from the coding prompt):

Step 1: Fit OLS trend on last 24 months of ``PortfolioSnapshot`` via
        ``numpy.polyfit``.
Step 2: Monte Carlo (n=10,000 simulations).  Each simulation draws:
         - origination_growth  ~ Normal(mean=trend_slope, sigma=historical_vol)
         - interest_rate_shock ~ Normal(0, 0.0025) per month  [25bps σ annual]
         - npl_shock           ~ LogNormal(log(base_npl), 0.15)
Step 3: Aggregate across simulations → p10, p50, p90 per month.
Step 4: Apply macro scenario overlay (multiplicative factor on growth +
        credit loss rates).

Random state is seeded per-request using a deterministic UUID-based seed
for reproducibility.  Confidence bands widen by ``sqrt(t)`` beyond
month 12 (``horizon == "24m"``).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import date, datetime, timezone
from dateutil.relativedelta import relativedelta
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Scenario macro overlay factors
# ─────────────────────────────────────────────────────────────────────────────

SCENARIO_FACTORS: dict[str, dict[str, float]] = {
    "base": {
        "growth_multiplier": 1.0,
        "loss_rate_multiplier": 1.0,
        "description": (
            "Bank Rate holds at 4.5%; GDP growth 1.2%; unemployment 4.3%"
        ),
    },
    "stress": {
        "growth_multiplier": 0.82,   # -18% originations growth
        "loss_rate_multiplier": 1.45, # +45% credit losses
        "description": (
            "Bank Rate rises 100bps; GDP contraction -0.5%; unemployment 5.8%"
        ),
    },
    "upside": {
        "growth_multiplier": 1.16,    # +16% originations growth
        "loss_rate_multiplier": 0.85, # -15% credit losses
        "description": (
            "Bank Rate cut 50bps; GDP growth 2.1%; unemployment 3.9%"
        ),
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Deterministic seed from request parameters
# ─────────────────────────────────────────────────────────────────────────────


def _request_seed(period: str, product: str, scenario: str, horizon: str) -> int:
    """Return a reproducible integer seed from the request key tuple."""
    key = f"{period}:{product}:{scenario}:{horizon}"
    digest = hashlib.sha256(key.encode()).hexdigest()
    return int(digest[:8], 16)  # 8 hex chars → fits in int32


# ─────────────────────────────────────────────────────────────────────────────
# OLS trend fit on historical snapshots
# ─────────────────────────────────────────────────────────────────────────────


def _fit_trend(values: list[float]) -> tuple[float, float, float]:
    """Fit OLS line to ``values`` (chronological order).

    Returns:
        (slope, intercept, historical_volatility)

    ``slope`` is the per-period absolute change.
    ``historical_volatility`` is the standard deviation of period-over-period
    changes — used as the Monte Carlo sigma.
    """
    n = len(values)
    if n < 2:
        return 0.0, float(values[0]) if values else 0.0, 0.0

    x = np.arange(n, dtype=float)
    coeffs = np.polyfit(x, values, 1)  # [slope, intercept]
    slope = float(coeffs[0])
    intercept = float(coeffs[1])

    # Historical volatility from period-over-period differences
    diffs = np.diff(values)
    hist_vol = float(np.std(diffs)) if len(diffs) >= 2 else abs(slope) * 0.15

    return slope, intercept, hist_vol


# ─────────────────────────────────────────────────────────────────────────────
# Monte Carlo simulation
# ─────────────────────────────────────────────────────────────────────────────

N_SIMULATIONS = 10_000
INTEREST_RATE_SIGMA_MONTHLY = 0.0025   # 25bps annual ÷ sqrt(12) ≈ 0.00072 but prompt says 0.0025/mo
NPL_LOGNORMAL_SIGMA = 0.15


def run_projections(
    snapshots_nii: list[float],
    snapshots_originations: list[float],
    snapshots_npl_rate: list[float],
    horizon_months: int,
    scenario: str,
    period: str = "mtd",
    product: str = "all",
) -> dict:
    """Run Monte Carlo revenue, originations, and NPL projections.

    Args:
        snapshots_nii:           Last ≤ 24 months of NII values (GBP), oldest first.
        snapshots_originations:  Last ≤ 24 months of originations volumes (GBP).
        snapshots_npl_rate:      Last ≤ 24 months of NPL rates (fractions 0–1).
        horizon_months:          12 or 24.
        scenario:                "base" | "stress" | "upside".
        period/product:          Used for seed derivation only.

    Returns:
        dict with keys: revenue_projection, originations_projection, npl_projection,
        plan_comparison, scenario_assumptions, generated_at.
    """
    if scenario not in SCENARIO_FACTORS:
        logger.warning("Unknown scenario '%s'; defaulting to 'base'", scenario)
        scenario = "base"

    overlay = SCENARIO_FACTORS[scenario]
    rng = np.random.default_rng(_request_seed(period, product, scenario, f"{horizon_months}m"))

    # ── Fit OLS trends ─────────────────────────────────────────────────────
    nii_slope, nii_last, nii_vol = _fit_trend(snapshots_nii or [0.0])
    orig_slope, orig_last, orig_vol = _fit_trend(snapshots_originations or [0.0])
    npl_base = float(np.mean(snapshots_npl_rate)) if snapshots_npl_rate else 0.02
    npl_vol = NPL_LOGNORMAL_SIGMA

    # ── Run simulations ────────────────────────────────────────────────────
    # Shape: (N_SIMULATIONS, horizon_months)
    growth_shocks = rng.normal(
        loc=nii_slope * overlay["growth_multiplier"],
        scale=nii_vol if nii_vol > 0 else abs(nii_slope) * 0.15,
        size=(N_SIMULATIONS, horizon_months),
    )
    rate_shocks = rng.normal(0, INTEREST_RATE_SIGMA_MONTHLY, size=(N_SIMULATIONS, horizon_months))

    orig_growth_shocks = rng.normal(
        loc=orig_slope * overlay["growth_multiplier"],
        scale=orig_vol if orig_vol > 0 else abs(orig_slope) * 0.15,
        size=(N_SIMULATIONS, horizon_months),
    )

    npl_shocks_log = rng.normal(
        np.log(max(npl_base * overlay["loss_rate_multiplier"], 1e-6)),
        npl_vol,
        size=(N_SIMULATIONS, horizon_months),
    )
    npl_shocks = np.exp(npl_shocks_log)

    # Cumulative NII per simulation per month (starting from last observed value)
    nii_paths = np.zeros((N_SIMULATIONS, horizon_months))
    orig_paths = np.zeros((N_SIMULATIONS, horizon_months))
    npl_paths = np.zeros((N_SIMULATIONS, horizon_months))

    for t in range(horizon_months):
        # Band-widening factor for t > 12 (sqrt(t/12) extra spread)
        widening = np.sqrt((t + 1) / 12) if t >= 12 else 1.0

        nii_paths[:, t] = (
            nii_last + growth_shocks[:, t] * (t + 1) + rate_shocks[:, t] * nii_last * widening
        )
        orig_paths[:, t] = (
            orig_last + orig_growth_shocks[:, t] * (t + 1) * widening
        )
        npl_paths[:, t] = npl_shocks[:, t] * widening

    # ── Percentiles per month ──────────────────────────────────────────────
    def _percentiles(paths: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        p10 = np.percentile(paths, 10, axis=0)
        p50 = np.percentile(paths, 50, axis=0)
        p90 = np.percentile(paths, 90, axis=0)
        # Enforce ordering: p10 ≤ p50 ≤ p90
        p10 = np.minimum(p10, p50)
        p90 = np.maximum(p50, p90)
        return p10, p50, p90

    nii_p10, nii_p50, nii_p90 = _percentiles(nii_paths)
    orig_p10, orig_p50, orig_p90 = _percentiles(orig_paths)
    npl_p10, npl_p50, npl_p90 = _percentiles(npl_paths)

    # ── Month labels ───────────────────────────────────────────────────────
    today = date.today()
    start_month = today.replace(day=1)
    month_labels = [
        (start_month + relativedelta(months=i + 1)).strftime("%Y-%m")
        for i in range(horizon_months)
    ]

    # ── Assemble response dicts ────────────────────────────────────────────
    revenue_months = [
        {
            "period": month_labels[i],
            "net_interest_income_p50": float(nii_p50[i]),
            "net_interest_income_p10": float(nii_p10[i]),
            "net_interest_income_p90": float(nii_p90[i]),
        }
        for i in range(horizon_months)
    ]
    orig_months = [
        {
            "period": month_labels[i],
            "volume_p50": float(orig_p50[i]),
            "volume_p10": float(orig_p10[i]),
            "volume_p90": float(orig_p90[i]),
        }
        for i in range(horizon_months)
    ]
    npl_months = [
        {
            "period": month_labels[i],
            "npl_rate_p50": float(np.clip(npl_p50[i], 0, 1)),
            "npl_rate_p10": float(np.clip(npl_p10[i], 0, 1)),
            "npl_rate_p90": float(np.clip(npl_p90[i], 0, 1)),
        }
        for i in range(horizon_months)
    ]

    # Year-end aggregates (sum NII; sum orig; final NPL rate month 12 or 24)
    year_end_idx = min(11, horizon_months - 1)  # index 11 = month 12
    yr_nii_p50 = float(nii_p50[:year_end_idx + 1].sum()) if horizon_months >= 12 else float(nii_p50.sum())
    yr_nii_p10 = float(nii_p10[:year_end_idx + 1].sum()) if horizon_months >= 12 else float(nii_p10.sum())
    yr_nii_p90 = float(nii_p90[:year_end_idx + 1].sum()) if horizon_months >= 12 else float(nii_p90.sum())
    yr_orig_p50 = float(orig_p50[:year_end_idx + 1].sum()) if horizon_months >= 12 else float(orig_p50.sum())
    yr_npl_p50 = float(np.clip(npl_p50[year_end_idx], 0, 1))

    # ── Plan comparison (static plan values used for gap calc) ─────────────
    # Plan values are hard-coded fiscal-year targets; override via env vars
    # in production to sync with the board-approved plan.
    import os
    revenue_plan = float(os.getenv("ANALYTICS_REVENUE_PLAN_GBP", "1_290_000_000".replace("_", "")))
    npl_plan_ceiling = float(os.getenv("ANALYTICS_NPL_PLAN_CEILING", "0.028"))

    revenue_p50_gap = (yr_nii_p50 - revenue_plan) / revenue_plan if revenue_plan else None
    npl_p90_within = float(np.clip(npl_p90[year_end_idx], 0, 1)) <= npl_plan_ceiling

    return {
        "horizon_months": horizon_months,
        "scenario": scenario,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "revenue_projection": {
            "months": revenue_months,
            "year_end_total_p50": yr_nii_p50,
            "year_end_total_p10": yr_nii_p10,
            "year_end_total_p90": yr_nii_p90,
        },
        "originations_projection": {
            "months": orig_months,
            "year_end_total_p50": yr_orig_p50,
        },
        "npl_projection": {
            "months": npl_months,
            "year_end_npl_rate_p50": yr_npl_p50,
        },
        "plan_comparison": {
            "revenue_plan": revenue_plan,
            "revenue_p50_gap_pct": revenue_p50_gap,
            "npl_plan_ceiling": npl_plan_ceiling,
            "npl_p90_within_plan": npl_p90_within,
        },
        "scenario_assumptions": {
            k: v["description"] for k, v in SCENARIO_FACTORS.items()
        },
    }
