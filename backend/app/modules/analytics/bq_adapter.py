"""Loan / BigQuery Data Adapter — Section 4.4.

Abstracts BigQuery live reads and Parquet fallback, always returning
canonical DataFrames that the aggregator can consume.

Set ``BQ_USE_PARQUET_FALLBACK=true`` (the default) to avoid requiring
live GCP credentials in development and demo environments.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

USE_BQ_PARQUET_FALLBACK: bool = (
    os.getenv("BQ_USE_PARQUET_FALLBACK", "true").lower() == "true"
)

# Parquet fallback paths — configurable via env vars
_PARQUET_LOAN_APPS = Path(
    os.getenv(
        "BQ_PARQUET_LOAN_APPS",
        "/Users/swarnabale/Documents/My Projects/credit-risk-platform/data/raw/loan_applications.parquet",
    )
)

DEFAULT_PROJECT = os.getenv("GCP_PROJECT_ID", "ai-risk-workflow")
DEFAULT_DATASET = os.getenv("BQ_DATASET_MODEL_DEV", "credit_risk_model_dev")


def _bq_query_period(
    table: str,
    ts_column: str,
    date_from: str,
    date_to: str,
    extra_where: str = "",
    dataset: str = DEFAULT_DATASET,
    project: str = DEFAULT_PROJECT,
) -> pd.DataFrame:
    """Execute a period-filtered BigQuery SELECT and return a DataFrame."""
    try:
        from app.shared.bigquery_client import get_bq_client

        client = get_bq_client()
        if client is None:
            return pd.DataFrame()

        where = f"{ts_column} >= '{date_from}' AND {ts_column} < '{date_to}'"
        if extra_where:
            where = f"{where} AND {extra_where}"

        sql = (
            f"SELECT * FROM `{project}.{dataset}.{table}` "
            f"WHERE {where} LIMIT 100000"
        )
        job = client.query(sql)
        return job.to_dataframe()
    except Exception as exc:
        logger.warning("BigQuery query failed for %s: %s", table, exc)
        return pd.DataFrame()


def _bq_query_raw(sql: str) -> pd.DataFrame:
    """Execute an arbitrary BigQuery SQL string and return a DataFrame."""
    try:
        from app.shared.bigquery_client import get_bq_client

        client = get_bq_client()
        if client is None:
            return pd.DataFrame()
        return client.query(sql).to_dataframe()
    except Exception as exc:
        logger.warning("BigQuery raw query failed: %s", exc)
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# Public load functions
# ---------------------------------------------------------------------------

def load_loan_applications(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    """Load loan applications.

    Source (live): ``ai-risk-workflow.credit_risk_model_dev.loan_applications``
    Parquet fallback: ``credit-risk-platform/data/raw/loan_applications.parquet``

    Key columns:
        application_id, submitted_at, loan_amount, loan_purpose, loan_term_months,
        annual_income, employment_status, employer_tenure_months, dti,
        credit_score, borrower_state, channel, is_thin_file,
        avg_monthly_cash_inflow, avg_monthly_cash_outflow
    """
    if USE_BQ_PARQUET_FALLBACK:
        if not _PARQUET_LOAN_APPS.exists():
            logger.warning("Parquet fallback not found: %s", _PARQUET_LOAN_APPS)
            return pd.DataFrame()
        df = pd.read_parquet(_PARQUET_LOAN_APPS)
        if date_from and "submitted_at" in df.columns:
            df = df[df["submitted_at"] >= pd.to_datetime(date_from)]
        if date_to and "submitted_at" in df.columns:
            df = df[df["submitted_at"] < pd.to_datetime(date_to)]
        return df

    return _bq_query_period(
        "loan_applications",
        "submitted_at",
        date_from or "2000-01-01",
        date_to or "2100-01-01",
    )


def load_credit_decisions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    """Load credit decisions.

    Source: ``ai-risk-workflow.credit_risk_model_dev.credit_decisions``

    Key columns:
        application_id, decision (APPROVE/REJECT/MANUAL_REVIEW),
        approved_amount, approved_rate, approved_term_months,
        reason_codes, policy_version, decision_latency_ms, decided_at
    """
    if USE_BQ_PARQUET_FALLBACK:
        # Derive from loan_applications fallback — decisions not always in Parquet
        df = load_loan_applications(date_from, date_to)
        if not df.empty and "loan_status" in df.columns:
            # Map status → decision vocabulary if possible
            df["decision"] = df["loan_status"].map(
                {"Fully Paid": "APPROVE", "Charged Off": "REJECT",
                 "Current": "APPROVE", "Default": "REJECT"}
            ).fillna("MANUAL_REVIEW")
        return df

    return _bq_query_period(
        "credit_decisions",
        "decided_at",
        date_from or "2000-01-01",
        date_to or "2100-01-01",
    )


def load_model_scores(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> pd.DataFrame:
    """Load model scores.

    Source: ``ai-risk-workflow.credit_risk_model_dev.model_scores``

    Key columns:
        application_id, pd_score, pd_band, fraud_probability, fraud_flag,
        recommended_rate, expected_loss, expected_profit,
        model_version, scored_at
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()  # not available in Parquet — aggregator skips gracefully

    return _bq_query_period(
        "model_scores",
        "scored_at",
        date_from or "2000-01-01",
        date_to or "2100-01-01",
    )


def load_fair_lending_reports() -> pd.DataFrame:
    """Load fair lending reports.

    Source: ``ai-risk-workflow.credit_risk_model_dev.fair_lending_reports``

    Key columns:
        protected_col, dir_score, dir_flag, protected_approval_rate,
        control_approval_rate, approval_parity_flag, n_total, n_approved,
        report_timestamp
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()

    return _bq_query_raw(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.fair_lending_reports`"
        " ORDER BY report_timestamp DESC LIMIT 500"
    )


def load_model_registry() -> pd.DataFrame:
    """Load model registry entries.

    Source: ``ai-risk-workflow.credit_risk_model_dev.model_registry``

    Key columns:
        model_name, model_version, status (champion/challenger/retired),
        auc_cv, ks_stat, gini, precision, recall, f1_score,
        training_rows, trained_at, promoted_at
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()

    return _bq_query_raw(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.model_registry`"
        " ORDER BY trained_at DESC LIMIT 100"
    )


def load_drift_reports(limit: int = 90) -> pd.DataFrame:
    """Load drift reports.

    Source: ``ai-risk-workflow.credit_risk_model_dev.drift_reports``

    Key columns:
        overall_drift_status, features_with_major_drift,
        psi_summary_json, alert_triggered, report_timestamp
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()

    return _bq_query_raw(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.drift_reports`"
        f" ORDER BY report_timestamp DESC LIMIT {limit}"
    )
