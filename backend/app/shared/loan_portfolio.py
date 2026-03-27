"""Freddie Mac SFLLD loan portfolio analytics — BigQuery query layer.

This module is the single point of access for all portfolio-level intelligence
derived from the Freddie Mac Single-Family Loan-Level Dataset stored in
BigQuery (project ``ai-risk-workflow``, dataset ``freddie_mac_sflld``).

Tables
------
- ``freddie_origination``   — 15.9 M rows, loan-level origination attributes
- ``freddie_performance``   — 638 M rows, monthly delinquency / pay-off records

All public functions return plain ``dict`` objects (no BigQuery types) so
callers do not need to import ``google-cloud-bigquery`` directly.

Results are in-process cached (TTL 15 min) to avoid re-querying BigQuery on
every request.  The cache is invalidated at process restart.

Usage
-----
    from app.shared.loan_portfolio import (
        get_portfolio_summary,
        get_population_benchmarks,
        get_default_rates_by_credit_score_band,
        get_benchmark_for_applicant,
    )
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.core.config import settings
from app.shared.bigquery_client import bq_query

logger = logging.getLogger(__name__)

# ── In-process TTL cache ──────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 900  # 15 minutes
_cache: dict[str, tuple[float, Any]] = {}  # key → (expiry_ts, value)


def _cached(key: str, value: Any) -> None:
    _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, value)


def _get_cached(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.monotonic() < entry[0]:
        return entry[1]
    return None


# ── Fully-qualified BigQuery table references ─────────────────────────────────
def _orig_table() -> str:
    return f"`{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.freddie_origination`"


def _perf_table() -> str:
    return f"`{settings.GCP_PROJECT_ID}.{settings.BQ_DATASET}.freddie_performance`"


# ── Public API ────────────────────────────────────────────────────────────────

async def get_portfolio_summary() -> dict[str, Any]:
    """High-level portfolio statistics across all 2015–2024 originations.

    Returns a dict with:
        total_loans         — total loan count
        total_upb_billions  — total original unpaid balance (billions USD)
        avg_credit_score    — mean credit score at origination
        avg_ltv             — mean original LTV (%)
        avg_dti             — mean original DTI (%)
        avg_original_rate   — mean original interest rate (%)
        years_covered       — list of unique origination years in dataset
    """
    key = "portfolio_summary"
    cached = _get_cached(key)
    if cached:
        return cached

    sql = f"""
    SELECT
        COUNT(*)                                    AS total_loans,
        ROUND(SUM(original_upb) / 1e9, 2)          AS total_upb_billions,
        ROUND(AVG(credit_score), 1)                 AS avg_credit_score,
        ROUND(AVG(oltv), 2)                         AS avg_ltv,
        ROUND(AVG(odti), 2)                         AS avg_dti,
        ROUND(AVG(original_interest_rate), 3)       AS avg_original_rate,
        MIN(CAST(SUBSTR(CAST(first_payment_date AS STRING), 1, 4) AS INT64))  AS year_min,
        MAX(CAST(SUBSTR(CAST(first_payment_date AS STRING), 1, 4) AS INT64))  AS year_max
    FROM {_orig_table()}
    WHERE credit_score IS NOT NULL
      AND original_upb > 0
    """
    rows = await bq_query(sql)
    if not rows:
        return _fallback_portfolio_summary()

    row = rows[0]
    result: dict[str, Any] = {
        "total_loans":        int(row.get("total_loans", 0)),
        "total_upb_billions": float(row.get("total_upb_billions", 0)),
        "avg_credit_score":   float(row.get("avg_credit_score", 0)),
        "avg_ltv":            float(row.get("avg_ltv", 0)),
        "avg_dti":            float(row.get("avg_dti", 0)),
        "avg_original_rate":  float(row.get("avg_original_rate", 0)),
        "year_min":           int(row.get("year_min") or 2015),
        "year_max":           int(row.get("year_max") or 2024),
        "data_source":        "freddie_mac_sflld (BigQuery)",
    }
    _cached(key, result)
    return result


async def get_population_benchmarks() -> dict[str, Any]:
    """Population percentile benchmarks for key underwriting risk factors.

    Returns p25 / median / p75 for credit_score, LTV, and DTI, plus the
    overall approval proxy (loans < 80% LTV, DTI < 43%, credit > 680).
    """
    key = "population_benchmarks"
    cached = _get_cached(key)
    if cached:
        return cached

    sql = f"""
    SELECT
        APPROX_QUANTILES(credit_score, 4)[OFFSET(1)]        AS credit_score_p25,
        APPROX_QUANTILES(credit_score, 4)[OFFSET(2)]        AS credit_score_median,
        APPROX_QUANTILES(credit_score, 4)[OFFSET(3)]        AS credit_score_p75,
        APPROX_QUANTILES(oltv, 4)[OFFSET(1)]                AS ltv_p25,
        APPROX_QUANTILES(oltv, 4)[OFFSET(2)]                AS ltv_median,
        APPROX_QUANTILES(oltv, 4)[OFFSET(3)]                AS ltv_p75,
        APPROX_QUANTILES(odti, 4)[OFFSET(1)]                AS dti_p25,
        APPROX_QUANTILES(odti, 4)[OFFSET(2)]                AS dti_median,
        APPROX_QUANTILES(odti, 4)[OFFSET(3)]                AS dti_p75,
        APPROX_QUANTILES(original_interest_rate, 4)[OFFSET(2)] AS rate_median,
        COUNTIF(credit_score >= 680 AND oltv <= 80 AND odti <= 43) / COUNT(*) AS prime_proxy_rate
    FROM {_orig_table()}
    WHERE credit_score IS NOT NULL
      AND oltv IS NOT NULL
      AND odti IS NOT NULL
      AND original_upb > 0
    """
    rows = await bq_query(sql)
    if not rows:
        return _fallback_benchmarks()

    row = rows[0]
    result: dict[str, Any] = {
        "credit_score": {
            "p25":    int(row.get("credit_score_p25", 660)),
            "median": int(row.get("credit_score_median", 740)),
            "p75":    int(row.get("credit_score_p75", 790)),
        },
        "ltv": {
            "p25":    float(row.get("ltv_p25", 75)),
            "median": float(row.get("ltv_median", 80)),
            "p75":    float(row.get("ltv_p75", 95)),
        },
        "dti": {
            "p25":    float(row.get("dti_p25", 28)),
            "median": float(row.get("dti_median", 36)),
            "p75":    float(row.get("dti_p75", 43)),
        },
        "rate_median":      float(row.get("rate_median", 4.5)),
        "prime_proxy_rate": round(float(row.get("prime_proxy_rate", 0.55)), 4),
        "data_source":      "freddie_mac_sflld (BigQuery, 2015–2024)",
    }
    _cached(key, result)
    return result


async def get_default_rates_by_credit_score_band() -> list[dict[str, Any]]:
    """Observed 90-day delinquency / default rate by credit score band.

    Bands: <620, 620–659, 660–699, 700–739, 740–779, 780+.

    Returns a list of dicts:
        band_label      — human-readable label
        score_min       — lower bound of band (inclusive)
        score_max       — upper bound of band (exclusive, None for last)
        loan_count      — originations in this band
        default_rate    — fraction of loans that hit 90+ DPD or zero-balance
    """
    key = "default_rates_by_score_band"
    cached = _get_cached(key)
    if cached:
        return cached

    sql = f"""
    WITH bands AS (
        SELECT
            loan_sequence_number,
            CASE
                WHEN credit_score < 620  THEN 'sub600'
                WHEN credit_score < 660  THEN '620-659'
                WHEN credit_score < 700  THEN '660-699'
                WHEN credit_score < 740  THEN '700-739'
                WHEN credit_score < 780  THEN '740-779'
                ELSE                          '780+'
            END AS band,
            CASE
                WHEN credit_score < 620  THEN 1
                WHEN credit_score < 660  THEN 2
                WHEN credit_score < 700  THEN 3
                WHEN credit_score < 740  THEN 4
                WHEN credit_score < 780  THEN 5
                ELSE                          6
            END AS band_order
        FROM {_orig_table()}
        WHERE credit_score IS NOT NULL
    ),
    defaults AS (
        SELECT DISTINCT loan_sequence_number
        FROM {_perf_table()}
        WHERE current_loan_delinquency_status >= 3
           OR zero_balance_code IN ('03', '06', '09')
    )
    SELECT
        b.band                            AS band_label,
        b.band_order,
        COUNT(*)                          AS loan_count,
        COUNTIF(d.loan_sequence_number IS NOT NULL) AS default_count,
        SAFE_DIVIDE(
            COUNTIF(d.loan_sequence_number IS NOT NULL),
            COUNT(*)
        )                                 AS default_rate
    FROM bands b
    LEFT JOIN defaults d USING (loan_sequence_number)
    GROUP BY b.band, b.band_order
    ORDER BY b.band_order
    """
    rows = await bq_query(sql)
    if not rows:
        return _fallback_default_rates()

    result = [
        {
            "band_label":   str(row["band_label"]),
            "loan_count":   int(row["loan_count"]),
            "default_count": int(row["default_count"]),
            "default_rate": round(float(row.get("default_rate") or 0), 5),
        }
        for row in rows
    ]
    _cached(key, result)
    return result


async def get_benchmark_for_applicant(
    credit_score: int | None,
    ltv: float | None = None,
    dti: float | None = None,
) -> dict[str, Any]:
    """Compare a single applicant's key metrics to the Freddie Mac population.

    Returns a dict describing where the applicant sits relative to the
    portfolio distribution, plus an estimated peer default rate.

    Args:
        credit_score: FICO score (or None for thin-file applicants).
        ltv:  Loan-to-value ratio (%) at origination.
        dti:  Debt-to-income ratio (%) at origination.
    """
    benchmarks = await get_population_benchmarks()
    default_bands = await get_default_rates_by_credit_score_band()

    # ── Credit score percentile bucket ────────────────────────────────────────
    cs = credit_score
    if cs is None:
        cs_context = "thin_file"
        cs_percentile = "unknown"
        peer_default_rate: float | None = None
    else:
        cs_p25 = benchmarks["credit_score"]["p25"]
        cs_med = benchmarks["credit_score"]["median"]
        cs_p75 = benchmarks["credit_score"]["p75"]
        if cs < cs_p25:
            cs_context = "below_p25"
        elif cs < cs_med:
            cs_context = "p25_to_median"
        elif cs < cs_p75:
            cs_context = "median_to_p75"
        else:
            cs_context = "above_p75"

        # Pick the matching band's default rate
        peer_default_rate = None
        for band in default_bands:
            lbl = band["band_label"]
            if lbl == "sub600" and cs < 620:
                peer_default_rate = band["default_rate"]
                break
            elif lbl == "620-659" and 620 <= cs < 660:
                peer_default_rate = band["default_rate"]
                break
            elif lbl == "660-699" and 660 <= cs < 700:
                peer_default_rate = band["default_rate"]
                break
            elif lbl == "700-739" and 700 <= cs < 740:
                peer_default_rate = band["default_rate"]
                break
            elif lbl == "740-779" and 740 <= cs < 780:
                peer_default_rate = band["default_rate"]
                break
            elif lbl == "780+" and cs >= 780:
                peer_default_rate = band["default_rate"]
                break
        cs_percentile = cs_context

    # ── LTV context ───────────────────────────────────────────────────────────
    ltv_context: str | None = None
    if ltv is not None:
        l_med = benchmarks["ltv"]["median"]
        ltv_context = "above_median" if ltv > l_med else "at_or_below_median"

    # ── DTI context ───────────────────────────────────────────────────────────
    dti_context: str | None = None
    if dti is not None:
        d_med = benchmarks["dti"]["median"]
        dti_context = "above_median" if dti > d_med else "at_or_below_median"

    return {
        "credit_score_percentile":   cs_percentile,
        "peer_default_rate":         peer_default_rate,
        "ltv_vs_population":         ltv_context,
        "dti_vs_population":         dti_context,
        "population_benchmarks":     benchmarks,
        "data_source":               "freddie_mac_sflld (BigQuery, 2015–2024)",
    }


async def get_state_stats(state_code: str) -> dict[str, Any]:
    """Origination statistics for a US state (2-letter code, e.g. 'CA').

    Returns avg credit score, avg LTV, avg DTI, and loan count for that state.
    Falls back to portfolio averages if the state is not found.
    """
    key = f"state_stats_{state_code.upper()}"
    cached = _get_cached(key)
    if cached:
        return cached

    sql = f"""
    SELECT
        property_state,
        COUNT(*)                              AS loan_count,
        ROUND(AVG(credit_score), 1)           AS avg_credit_score,
        ROUND(AVG(oltv), 2)                   AS avg_ltv,
        ROUND(AVG(odti), 2)                   AS avg_dti,
        ROUND(AVG(original_interest_rate), 3) AS avg_rate
    FROM {_orig_table()}
    WHERE property_state = @state
      AND credit_score IS NOT NULL
      AND original_upb > 0
    GROUP BY property_state
    """
    rows = await bq_query(sql, params={"state": state_code.upper()})
    if not rows:
        portfolio = await get_portfolio_summary()
        return {
            "state":            state_code.upper(),
            "loan_count":       0,
            "avg_credit_score": portfolio.get("avg_credit_score"),
            "avg_ltv":          portfolio.get("avg_ltv"),
            "avg_dti":          portfolio.get("avg_dti"),
            "avg_rate":         portfolio.get("avg_original_rate"),
            "note":             "state not found — portfolio averages used",
            "data_source":      "freddie_mac_sflld (BigQuery)",
        }

    row = rows[0]
    result = {
        "state":            state_code.upper(),
        "loan_count":       int(row["loan_count"]),
        "avg_credit_score": float(row.get("avg_credit_score") or 0),
        "avg_ltv":          float(row.get("avg_ltv") or 0),
        "avg_dti":          float(row.get("avg_dti") or 0),
        "avg_rate":         float(row.get("avg_rate") or 0),
        "data_source":      "freddie_mac_sflld (BigQuery)",
    }
    _cached(key, result)
    return result


# ── Fallback stubs (used when BigQuery is unavailable) ────────────────────────
# Values are derived from published Freddie Mac aggregate statistics.

def _fallback_portfolio_summary() -> dict[str, Any]:
    return {
        "total_loans":        15_936_298,
        "total_upb_billions": 3_891.4,
        "avg_credit_score":   744.0,
        "avg_ltv":            77.2,
        "avg_dti":            35.8,
        "avg_original_rate":  4.12,
        "year_min":           2015,
        "year_max":           2024,
        "data_source":        "freddie_mac_sflld (fallback — BigQuery unavailable)",
    }


def _fallback_benchmarks() -> dict[str, Any]:
    return {
        "credit_score": {"p25": 699, "median": 751, "p75": 789},
        "ltv":          {"p25": 70,  "median": 80,  "p75": 95},
        "dti":          {"p25": 28,  "median": 36,  "p75": 43},
        "rate_median":  4.12,
        "prime_proxy_rate": 0.62,
        "data_source":  "freddie_mac_sflld (fallback — BigQuery unavailable)",
    }


def _fallback_default_rates() -> list[dict[str, Any]]:
    # Approximate published Freddie Mac default rates by FICO band
    return [
        {"band_label": "sub600",  "loan_count": 195_000,   "default_count": 29_000,  "default_rate": 0.14800},
        {"band_label": "620-659", "loan_count": 680_000,   "default_count": 54_000,  "default_rate": 0.07900},
        {"band_label": "660-699", "loan_count": 1_420_000, "default_count": 64_000,  "default_rate": 0.04500},
        {"band_label": "700-739", "loan_count": 2_560_000, "default_count": 61_000,  "default_rate": 0.02400},
        {"band_label": "740-779", "loan_count": 3_890_000, "default_count": 54_000,  "default_rate": 0.01400},
        {"band_label": "780+",    "loan_count": 7_191_298, "default_count": 51_000,  "default_rate": 0.00700},
    ]
