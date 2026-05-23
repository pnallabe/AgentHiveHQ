"""Analytics Aggregator — Section 5.3.

Reads from cc_adapter (Parquet) and bq_adapter (BigQuery / Parquet),
computes dashboard KPIs, and returns typed dicts that api.py assembles
into Pydantic response models.

All KPI formulas follow the derivation map in Section 4.5 of the coding
prompt exactly.  When a required column is absent the KPI is `None` and
the field name is pushed onto the ``affected_kpis`` list returned by
every compute function so the API layer can build the correct
``data_availability`` payload.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd

from app.modules.analytics.cc_adapter import (
    load_cc_accounts,
    load_cc_pd_scores,
    load_cc_txn_summary,
    load_cc_cost_assumptions,
)
from app.modules.analytics.bq_adapter import (
    load_loan_applications,
    load_credit_decisions,
    load_model_scores,
    load_fair_lending_reports,
    load_model_registry,
    load_drift_reports,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Period resolution
# ─────────────────────────────────────────────────────────────────────────────


def resolve_period(
    period: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> tuple[str, str]:
    """Return ``(date_from_iso, date_to_iso)`` for the given period token.

    Accepted tokens: ``mtd`` | ``qtd`` | ``ytd`` | ``last_30`` | ``last_90``
    | ``last_12m`` | ``custom``.

    For ``custom`` the caller MUST supply both ``date_from`` and ``date_to``.
    Falls back to ``mtd`` for unrecognised tokens.
    """
    today = date.today()

    if period == "mtd":
        return today.replace(day=1).isoformat(), today.isoformat()

    if period == "qtd":
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        q_start = today.replace(month=q_start_month, day=1)
        return q_start.isoformat(), today.isoformat()

    if period == "ytd":
        return today.replace(month=1, day=1).isoformat(), today.isoformat()

    if period == "last_30":
        return (today - timedelta(days=30)).isoformat(), today.isoformat()

    if period == "last_90":
        return (today - timedelta(days=90)).isoformat(), today.isoformat()

    if period == "last_12m":
        return (today - timedelta(days=365)).isoformat(), today.isoformat()

    if period == "custom":
        if not date_from or not date_to:
            logger.warning("custom period requested without date_from/date_to; falling back to MTD")
            return today.replace(day=1).isoformat(), today.isoformat()
        return date_from, date_to

    # Default fallback
    logger.warning("Unrecognised period token '%s'; falling back to MTD", period)
    return today.replace(day=1).isoformat(), today.isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Helper: safe column access
# ─────────────────────────────────────────────────────────────────────────────


def _safe_mean(df: pd.DataFrame, col: str) -> Optional[float]:
    if col not in df.columns or df.empty:
        return None
    try:
        v = float(df[col].mean())
        return None if np.isnan(v) else v
    except Exception:
        return None


def _safe_sum(df: pd.DataFrame, col: str) -> Optional[float]:
    if col not in df.columns or df.empty:
        return None
    try:
        return float(df[col].sum())
    except Exception:
        return None


def _safe_count(df: pd.DataFrame, col: str) -> Optional[int]:
    if col not in df.columns or df.empty:
        return None
    return int(df[col].nunique())


# ─────────────────────────────────────────────────────────────────────────────
# Credit card KPIs
# ─────────────────────────────────────────────────────────────────────────────


def compute_cc_kpis(
    df_orig: pd.DataFrame,
    df_pd: pd.DataFrame,
    df_txn: pd.DataFrame,
    df_cost: pd.DataFrame,
) -> dict:
    """Compute all credit card dashboard KPIs.

    Args:
        df_orig: origination_5m.parquet — account_id, credit_limit,
                 interest_rate, risk_segment, channel, open_date
        df_pd:   pd_training_5m.parquet — account_id, pd_score,
                 default_flag, risk_segment
        df_txn:  txn_summary_5m.parquet — account_id, period,
                 interest_charged, fees_charged, statement_balance
        df_cost: cost_assumptions.parquet — cost_of_funds_rate,
                 acquisition_cost_avg

    Returns:
        dict with kpi values; missing → None.  ``affected_kpis`` key
        lists every field that is None so the caller can build the
        ``data_availability`` envelope.
    """
    affected: list[str] = []

    def _flag(key: str, val: object) -> object:
        if val is None:
            affected.append(key)
        return val

    # ── Volume ─────────────────────────────────────────────────────────────
    total_accounts = _flag(
        "cc_total_accounts",
        _safe_count(df_orig, "account_id"),
    )

    # Active accounts: proxy = accounts with a recent positive statement balance
    if "account_id" in df_txn.columns and "statement_balance" in df_txn.columns:
        active_ids = df_txn[df_txn["statement_balance"] > 0]["account_id"].nunique()
        active_accounts: Optional[int] = int(active_ids)
    else:
        active_accounts = None
        affected.append("cc_active_accounts")

    # ── Pricing / limits ───────────────────────────────────────────────────
    avg_credit_limit = _flag("cc_avg_credit_limit", _safe_mean(df_orig, "credit_limit"))
    avg_apr = _flag("cc_avg_apr", _safe_mean(df_orig, "interest_rate"))

    # ── Utilisation ────────────────────────────────────────────────────────
    avg_util: Optional[float] = None
    if (
        "statement_balance" in df_txn.columns
        and "account_id" in df_txn.columns
        and "account_id" in df_orig.columns
        and "credit_limit" in df_orig.columns
    ):
        merged = df_txn[["account_id", "statement_balance"]].merge(
            df_orig[["account_id", "credit_limit"]], on="account_id", how="left"
        )
        merged = merged[merged["credit_limit"] > 0].copy()
        if not merged.empty:
            merged["utilisation"] = merged["statement_balance"] / merged["credit_limit"]
            v = float(merged["utilisation"].mean())
            avg_util = None if np.isnan(v) else v
    if avg_util is None:
        affected.append("cc_avg_utilisation")

    # ── Risk ───────────────────────────────────────────────────────────────
    npl_rate = _flag("cc_npl_rate", _safe_mean(df_pd, "default_flag"))
    avg_pd_score = _flag("cc_avg_pd_score", _safe_mean(df_pd, "pd_score"))

    # ── Income ─────────────────────────────────────────────────────────────
    interest_income = _flag("cc_interest_income", _safe_sum(df_txn, "interest_charged"))
    fee_income = _flag("cc_fee_income", _safe_sum(df_txn, "fees_charged"))

    # ── Cost of funds ──────────────────────────────────────────────────────
    cof_rate = _safe_mean(df_cost, "cost_of_funds_rate") or 0.055
    total_balance = _safe_sum(df_txn, "statement_balance")
    cost_of_funds: Optional[float] = (total_balance * cof_rate) if total_balance else None
    if cost_of_funds is None:
        affected.append("cc_cost_of_funds")

    # ── NII / NIM ──────────────────────────────────────────────────────────
    nii: Optional[float] = None
    if interest_income is not None and cost_of_funds is not None:
        nii = interest_income - cost_of_funds
    if nii is None:
        affected.append("cc_net_interest_income")

    nim: Optional[float] = None
    if nii is not None and total_balance and total_balance > 0:
        nim = nii / total_balance
    if nim is None:
        affected.append("cc_net_interest_margin")

    # ── Mix breakdowns ─────────────────────────────────────────────────────
    risk_mix = (
        df_orig["risk_segment"].value_counts(normalize=True).to_dict()
        if "risk_segment" in df_orig.columns
        else {}
    )
    channel_mix = (
        df_orig["channel"].value_counts(normalize=True).to_dict()
        if "channel" in df_orig.columns
        else {}
    )

    # ── CAC ────────────────────────────────────────────────────────────────
    cac_avg = _flag("cc_cac_avg", _safe_mean(df_cost, "acquisition_cost_avg"))

    return {
        "total_accounts": total_accounts,
        "active_accounts": active_accounts,
        "average_credit_limit": avg_credit_limit,
        "average_apr": avg_apr,
        "average_utilisation": avg_util,
        "npl_rate": npl_rate,
        "avg_pd_score": avg_pd_score,
        "net_interest_income": nii,
        "net_interest_margin": nim,
        "interest_income": interest_income,
        "fee_income": fee_income,
        "cost_of_funds": cost_of_funds,
        "total_balance": total_balance,
        "risk_segment_mix": risk_mix,
        "origination_channel_mix": channel_mix,
        "customer_acquisition_cost_avg": cac_avg,
        "affected_kpis": affected,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Loan KPIs (BigQuery sources)
# ─────────────────────────────────────────────────────────────────────────────


def compute_loan_kpis(
    df_apps: pd.DataFrame,
    df_decisions: pd.DataFrame,
    df_scores: pd.DataFrame,
) -> dict:
    """Compute all loan dashboard KPIs.

    Args:
        df_apps:      BigQuery loan_applications — application_id, loan_amount,
                      loan_type, loan_term_months, annual_income, dti,
                      credit_score, borrower_state, channel,
                      employment_status, is_thin_file, submitted_at
        df_decisions: BigQuery credit_decisions  — application_id, decision,
                      approved_amount, approved_rate, reason_codes,
                      policy_version, decision_latency_ms, decided_at
        df_scores:    BigQuery model_scores      — application_id, pd_score,
                      pd_band, expected_loss, expected_profit, model_version

    Returns:
        dict with kpi values; missing values are None.  ``affected_kpis``
        lists every None field.
    """
    affected: list[str] = []

    def _flag(key: str, val: object) -> object:
        if val is None:
            affected.append(key)
        return val

    # ── Applications ───────────────────────────────────────────────────────
    total_apps = _flag("loan_total_applications", len(df_apps) if not df_apps.empty else None)

    # ── Decisions ──────────────────────────────────────────────────────────
    approved: pd.DataFrame = pd.DataFrame()
    approval_rate: Optional[float] = None
    if not df_decisions.empty and "decision" in df_decisions.columns:
        approved = df_decisions[df_decisions["decision"] == "APPROVE"]
        n_total = len(df_decisions)
        approval_rate = float(len(approved) / n_total) if n_total > 0 else None
    if approval_rate is None:
        affected.append("loan_approval_rate")

    originations_volume = _flag(
        "loan_originations_volume", _safe_sum(approved, "approved_amount")
    )
    avg_loan_size = _flag("loan_avg_size", _safe_mean(approved, "approved_amount"))
    avg_apr = _flag("loan_avg_apr", _safe_mean(approved, "approved_rate"))

    decision_latency_p95: Optional[float] = None
    if "decision_latency_ms" in df_decisions.columns and not df_decisions.empty:
        try:
            decision_latency_p95 = float(df_decisions["decision_latency_ms"].quantile(0.95))
        except Exception:
            pass
    if decision_latency_p95 is None:
        affected.append("loan_decision_latency_p95")

    # ── Model scores ───────────────────────────────────────────────────────
    expected_loss = _flag("loan_expected_loss", _safe_sum(df_scores, "expected_loss"))
    expected_profit = _flag("loan_expected_profit", _safe_sum(df_scores, "expected_profit"))
    avg_pd = _flag("loan_avg_pd_score", _safe_mean(df_scores, "pd_score"))
    pd_band_dist = (
        df_scores["pd_band"].value_counts(normalize=True).to_dict()
        if "pd_band" in df_scores.columns
        else {}
    )

    # ── Applicant profile ──────────────────────────────────────────────────
    avg_dti = _flag("loan_avg_dti", _safe_mean(df_apps, "dti"))
    avg_credit_score = _flag("loan_avg_credit_score", _safe_mean(df_apps, "credit_score"))
    thin_file_rate = _flag(
        "loan_thin_file_rate",
        _safe_mean(df_apps, "is_thin_file"),
    )
    state_dist = (
        df_apps["borrower_state"].value_counts(normalize=True).head(10).to_dict()
        if "borrower_state" in df_apps.columns
        else {}
    )
    channel_mix = (
        df_apps["channel"].value_counts(normalize=True).to_dict()
        if "channel" in df_apps.columns
        else {}
    )

    return {
        "total_applications": total_apps,
        "approval_rate": approval_rate,
        "originations_volume": originations_volume,
        "average_loan_size": avg_loan_size,
        "average_approved_apr": avg_apr,
        "decision_latency_p95_ms": decision_latency_p95,
        "expected_loss": expected_loss,
        "expected_profit": expected_profit,
        "average_pd_score": avg_pd,
        "pd_band_distribution": pd_band_dist,
        "average_dti": avg_dti,
        "average_credit_score": avg_credit_score,
        "thin_file_rate": thin_file_rate,
        "state_distribution": state_dist,
        "origination_channel_mix": channel_mix,
        "affected_kpis": affected,
    }


# ─────────────────────────────────────────────────────────────────────────────
# High-level aggregation entry points (called from service.py)
# ─────────────────────────────────────────────────────────────────────────────


def aggregate_cc(date_from: str, date_to: str) -> dict:
    """Load all CC source DataFrames and compute KPIs for ``date_from``–``date_to``."""
    df_orig = load_cc_accounts()
    df_pd = load_cc_pd_scores()
    df_txn = load_cc_txn_summary()
    df_cost = load_cc_cost_assumptions()

    # Filter by period where date columns are available
    for col in ("open_date", "statement_date"):
        if col in df_orig.columns:
            df_orig[col] = pd.to_datetime(df_orig[col], errors="coerce")
            mask = (df_orig[col] >= pd.Timestamp(date_from)) & (
                df_orig[col] <= pd.Timestamp(date_to)
            )
            df_orig = df_orig[mask]
            break

    if "period" in df_txn.columns:
        df_txn["period"] = pd.to_datetime(df_txn["period"], errors="coerce")
        mask = (df_txn["period"] >= pd.Timestamp(date_from)) & (
            df_txn["period"] <= pd.Timestamp(date_to)
        )
        df_txn = df_txn[mask]

    return compute_cc_kpis(df_orig, df_pd, df_txn, df_cost)


def aggregate_loans(date_from: str, date_to: str) -> dict:
    """Load all loan/BQ DataFrames and compute KPIs for ``date_from``–``date_to``."""
    df_apps = load_loan_applications(date_from, date_to)
    df_dec = load_credit_decisions(date_from, date_to)
    df_scores = load_model_scores(date_from, date_to)
    return compute_loan_kpis(df_apps, df_dec, df_scores)


def merge_affected_kpis(*kpi_dicts: dict) -> list[str]:
    """Return deduplicated union of ``affected_kpis`` from multiple compute results."""
    seen: set[str] = set()
    result: list[str] = []
    for d in kpi_dicts:
        for k in d.get("affected_kpis", []):
            if k not in seen:
                seen.add(k)
                result.append(k)
    return result
