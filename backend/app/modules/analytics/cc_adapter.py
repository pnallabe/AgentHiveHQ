"""Credit Card Analytics Adapter — Section 18.11.

Routes portfolio queries to BigQuery external tables when available,
falling back to local Parquet files in development / demo environments.

Usage
-----
    from app.modules.analytics.cc_adapter import CreditCardAdapter

    adapter = CreditCardAdapter(bq_dataset="credit_risk_model_dev")
    df = adapter.get_portfolio_summary(year=2023, month=12)
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# ----- BigQuery table registry ------------------------------------------------
CC_ANALYTICS_BQ_TABLES: dict[str, str] = {
    "customers":           "cc_customers",
    "originations":        "cc_originations",
    "monthly_statements":  "cc_monthly_statements",
    "transactions":        "cc_transactions",
    "credit_limit_events": "cc_credit_limit_events",
}

# Parquet fallback directory (relative to repo root, overridable via env)
_DEFAULT_PARQUET_ROOT = Path(__file__).resolve().parents[4] / "data" / "cc_analytics"


class CreditCardAdapter:
    """Unified read interface for the 5M-customer credit-card dataset.

    Parameters
    ----------
    bq_dataset:
        BigQuery dataset identifier, e.g. ``"credit_risk_model_dev"``.
    bq_project:
        GCP project that owns the BigQuery dataset.  Defaults to the
        ``GCP_PROJECT_ID`` environment variable.
    parquet_root:
        Local directory containing the Parquet fallback files.  Defaults
        to ``data/cc_analytics/`` relative to the repository root.
    """

    def __init__(
        self,
        bq_dataset: str = "credit_risk_model_dev",
        bq_project: str | None = None,
        parquet_root: Path | str | None = None,
    ) -> None:
        self.bq_dataset = bq_dataset
        self.bq_project = bq_project or os.environ.get("GCP_PROJECT_ID", "ai-risk-workflow")
        self.parquet_root = Path(parquet_root) if parquet_root else _DEFAULT_PARQUET_ROOT
        self._bq_client: Any | None = _load_bq_client()
        self._source_cache: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Internal routing helpers
    # ------------------------------------------------------------------

    def _resolve_source(self, table_key: str) -> str:
        """Return ``'bq'`` if the BigQuery external table is reachable, else ``'parquet'``."""
        if table_key in self._source_cache:
            return self._source_cache[table_key]

        if not self._bq_client:
            self._source_cache[table_key] = "parquet"
            return "parquet"

        try:
            bq_table = CC_ANALYTICS_BQ_TABLES[table_key]
            query = f"SELECT 1 FROM `{self.bq_project}.{self.bq_dataset}.{bq_table}` LIMIT 1"
            list(self._bq_client.query(query).result())
            self._source_cache[table_key] = "bq"
            logger.debug("BQ source confirmed for table '%s'", table_key)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "BigQuery probe failed for '%s', using Parquet fallback: %s",
                table_key,
                exc,
            )
            self._source_cache[table_key] = "parquet"

        return self._source_cache[table_key]

    def _bq_query(self, sql: str) -> pd.DataFrame:
        """Run *sql* against BigQuery and return a ``DataFrame``."""
        job = self._bq_client.query(sql)
        return job.to_dataframe()

    def _parquet(self, relative_path: str, columns: list[str] | None = None) -> pd.DataFrame:
        """Read a Parquet file from the local fallback tree."""
        path = self.parquet_root / relative_path
        if not path.exists():
            logger.error("Parquet path not found: %s", path)
            return pd.DataFrame()
        return pd.read_parquet(path, columns=columns)

    def _stmt_parquet(self, year: int, month: int, columns: list[str] | None = None) -> pd.DataFrame:
        path = self.parquet_root / "cc_monthly_statements" / f"year={year}" / f"month={month:02d}" / "statements.parquet"
        if not path.exists():
            return pd.DataFrame()
        return pd.read_parquet(path, columns=columns)

    def _txn_parquet(self, year: int, month: int, columns: list[str] | None = None) -> pd.DataFrame:
        path = self.parquet_root / "cc_transactions" / f"year={year}" / f"month={month:02d}" / "transactions.parquet"
        if not path.exists():
            return pd.DataFrame()
        return pd.read_parquet(path, columns=columns)

    # ------------------------------------------------------------------
    # Public query methods
    # ------------------------------------------------------------------

    def get_portfolio_summary(self, year: int, month: int) -> pd.DataFrame:
        """Return product-level KPIs for the given statement period.

        Columns
        -------
        product_id, active_accounts, total_balance, avg_utilization,
        total_interest_revenue, total_interchange_revenue, total_fee_revenue,
        delinquent_accounts
        """
        if self._resolve_source("monthly_statements") == "bq":
            sql = f"""
                SELECT
                  product_id,
                  COUNT(DISTINCT customer_id)                        AS active_accounts,
                  SUM(balance_usd)                                   AS total_balance,
                  AVG(utilization_rate)                              AS avg_utilization,
                  SUM(interest_revenue_usd)                          AS total_interest_revenue,
                  SUM(interchange_revenue_usd)                       AS total_interchange_revenue,
                  SUM(fee_revenue_usd)                               AS total_fee_revenue,
                  COUNTIF(delinquency_status != 'CURRENT')           AS delinquent_accounts
                FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements`
                WHERE year = {year} AND month = {month}
                GROUP BY product_id
            """
            return self._bq_query(sql)

        df = self._stmt_parquet(
            year, month,
            columns=[
                "product_id", "customer_id", "balance_usd", "utilization_rate",
                "interest_revenue_usd", "interchange_revenue_usd", "fee_revenue_usd",
                "delinquency_status",
            ],
        )
        if df.empty:
            return df

        return (
            df.groupby("product_id")
            .agg(
                active_accounts=("customer_id", "nunique"),
                total_balance=("balance_usd", "sum"),
                avg_utilization=("utilization_rate", "mean"),
                total_interest_revenue=("interest_revenue_usd", "sum"),
                total_interchange_revenue=("interchange_revenue_usd", "sum"),
                total_fee_revenue=("fee_revenue_usd", "sum"),
                delinquent_accounts=("delinquency_status", lambda s: (s != "CURRENT").sum()),
            )
            .reset_index()
        )

    def get_vintage_default_curve(
        self,
        product_id: str | None = None,
        cohort_years: list[int] | None = None,
    ) -> pd.DataFrame:
        """Return monthly cumulative default rates by origination cohort year.

        Columns
        -------
        cohort_year, account_age_months, cumulative_default_rate
        """
        cohort_filter = ""
        if cohort_years:
            cohort_str = ", ".join(str(y) for y in cohort_years)
            cohort_filter += f" AND EXTRACT(YEAR FROM o.origination_date) IN ({cohort_str})"
        product_filter = f" AND s.product_id = '{product_id}'" if product_id else ""

        if self._resolve_source("monthly_statements") == "bq":
            sql = f"""
                WITH base AS (
                  SELECT
                    EXTRACT(YEAR FROM o.origination_date)  AS cohort_year,
                    s.account_age_months,
                    COUNTIF(s.delinquency_status = 'CHARGED_OFF') AS defaults,
                    COUNT(*)                                      AS total
                  FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements` s
                  JOIN `{self.bq_project}.{self.bq_dataset}.cc_originations` o
                    USING (origination_id)
                  WHERE 1=1 {cohort_filter} {product_filter}
                  GROUP BY 1, 2
                )
                SELECT
                  cohort_year,
                  account_age_months,
                  SUM(defaults) / NULLIF(SUM(total), 0) AS cumulative_default_rate
                FROM base
                GROUP BY 1, 2
                ORDER BY 1, 2
            """
            return self._bq_query(sql)

        # Parquet fallback — load all partitions for the requested cohorts
        frames: list[pd.DataFrame] = []
        years_to_load = cohort_years or list(range(2015, 2025))
        for year in years_to_load:
            for month in range(1, 13):
                chunk = self._stmt_parquet(
                    year, month,
                    columns=["origination_id", "product_id", "account_age_months", "delinquency_status"],
                )
                if not chunk.empty:
                    frames.append(chunk)
        if not frames:
            return pd.DataFrame()

        df = pd.concat(frames, ignore_index=True)
        if product_id:
            df = df[df["product_id"] == product_id]
        grouped = (
            df.groupby("account_age_months")
            .agg(
                defaults=("delinquency_status", lambda s: (s == "CHARGED_OFF").sum()),
                total=("delinquency_status", "count"),
            )
            .reset_index()
        )
        grouped["cumulative_default_rate"] = grouped["defaults"] / grouped["total"].replace(0, float("nan"))
        return grouped

    def get_delinquency_roll_rates(self, year: int, month: int) -> pd.DataFrame:
        """Return FROM→TO delinquency state transition counts for a given period.

        Columns
        -------
        from_status, to_status, account_count
        """
        from_month, from_year = (month - 1, year) if month > 1 else (12, year - 1)
        if self._resolve_source("monthly_statements") == "bq":
            sql = f"""
                WITH prev AS (
                  SELECT origination_id, delinquency_status AS from_status
                  FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements`
                  WHERE year = {from_year} AND month = {from_month}
                ),
                curr AS (
                  SELECT origination_id, delinquency_status AS to_status
                  FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements`
                  WHERE year = {year} AND month = {month}
                )
                SELECT
                  p.from_status,
                  c.to_status,
                  COUNT(*) AS account_count
                FROM prev p
                JOIN curr c USING (origination_id)
                GROUP BY 1, 2
                ORDER BY 1, 2
            """
            return self._bq_query(sql)

        prev = self._stmt_parquet(from_year, from_month, columns=["origination_id", "delinquency_status"])
        curr = self._stmt_parquet(year, month, columns=["origination_id", "delinquency_status"])
        if prev.empty or curr.empty:
            return pd.DataFrame()
        merged = prev.merge(curr, on="origination_id", suffixes=("_from", "_to"))
        return (
            merged.groupby(["delinquency_status_from", "delinquency_status_to"])
            .size()
            .reset_index(name="account_count")
            .rename(columns={"delinquency_status_from": "from_status", "delinquency_status_to": "to_status"})
        )

    def get_revenue_breakdown(self, year: int) -> pd.DataFrame:
        """Annual revenue by product and revenue type.

        Columns
        -------
        product_id, month, interest_revenue, interchange_revenue, fee_revenue,
        rewards_cost, net_revenue
        """
        if self._resolve_source("monthly_statements") == "bq":
            sql = f"""
                SELECT
                  product_id,
                  month,
                  SUM(interest_revenue_usd)     AS interest_revenue,
                  SUM(interchange_revenue_usd)  AS interchange_revenue,
                  SUM(fee_revenue_usd)           AS fee_revenue,
                  SUM(rewards_cost_usd)          AS rewards_cost,
                  SUM(interest_revenue_usd + interchange_revenue_usd + fee_revenue_usd - rewards_cost_usd) AS net_revenue
                FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements`
                WHERE year = {year}
                GROUP BY 1, 2
                ORDER BY 1, 2
            """
            return self._bq_query(sql)

        frames = []
        for month in range(1, 13):
            chunk = self._stmt_parquet(
                year, month,
                columns=["product_id", "interest_revenue_usd", "interchange_revenue_usd",
                         "fee_revenue_usd", "rewards_cost_usd"],
            )
            if not chunk.empty:
                chunk["month"] = month
                frames.append(chunk)
        if not frames:
            return pd.DataFrame()

        df = pd.concat(frames, ignore_index=True)
        agg = (
            df.groupby(["product_id", "month"])
            .agg(
                interest_revenue=("interest_revenue_usd", "sum"),
                interchange_revenue=("interchange_revenue_usd", "sum"),
                fee_revenue=("fee_revenue_usd", "sum"),
                rewards_cost=("rewards_cost_usd", "sum"),
            )
            .reset_index()
        )
        agg["net_revenue"] = agg["interest_revenue"] + agg["interchange_revenue"] + agg["fee_revenue"] - agg["rewards_cost"]
        return agg

    def get_utilization_distribution(self, year: int, month: int) -> pd.DataFrame:
        """Utilization rate distribution bucketed into deciles.

        Columns
        -------
        bucket, account_count, pct_of_total
        """
        if self._resolve_source("monthly_statements") == "bq":
            sql = f"""
                SELECT
                  CAST(FLOOR(utilization_rate * 10) AS INT64)  AS bucket,
                  COUNT(*)                                       AS account_count,
                  COUNT(*) / SUM(COUNT(*)) OVER ()              AS pct_of_total
                FROM `{self.bq_project}.{self.bq_dataset}.cc_monthly_statements`
                WHERE year = {year} AND month = {month}
                  AND delinquency_status NOT IN ('CHARGED_OFF', 'CLOSED')
                GROUP BY 1
                ORDER BY 1
            """
            return self._bq_query(sql)

        df = self._stmt_parquet(year, month, columns=["utilization_rate", "delinquency_status"])
        if df.empty:
            return df
        df = df[~df["delinquency_status"].isin(["CHARGED_OFF", "CLOSED"])]
        df["bucket"] = (df["utilization_rate"] * 10).astype(int).clip(0, 10)
        counts = df["bucket"].value_counts().sort_index().reset_index(name="account_count")
        counts.rename(columns={"index": "bucket"}, inplace=True)
        counts["pct_of_total"] = counts["account_count"] / counts["account_count"].sum()
        return counts

    def get_customer_demographics(self, segment: str | None = None) -> pd.DataFrame:
        """Aggregate customer demographic distribution.

        Parameters
        ----------
        segment:
            Optional employment_type filter.

        Columns
        -------
        state, age_band, employment_type, income_bucket, account_count
        """
        if self._resolve_source("customers") == "bq":
            segment_filter = f"WHERE employment_type = '{segment}'" if segment else ""
            sql = f"""
                SELECT
                  state,
                  CASE
                    WHEN DATE_DIFF(CURRENT_DATE(), date_of_birth, YEAR) < 25  THEN '18-24'
                    WHEN DATE_DIFF(CURRENT_DATE(), date_of_birth, YEAR) < 35  THEN '25-34'
                    WHEN DATE_DIFF(CURRENT_DATE(), date_of_birth, YEAR) < 45  THEN '35-44'
                    WHEN DATE_DIFF(CURRENT_DATE(), date_of_birth, YEAR) < 55  THEN '45-54'
                    WHEN DATE_DIFF(CURRENT_DATE(), date_of_birth, YEAR) < 65  THEN '55-64'
                    ELSE '65+'
                  END AS age_band,
                  employment_type,
                  CASE
                    WHEN income_annual_usd < 35000  THEN '<35k'
                    WHEN income_annual_usd < 60000  THEN '35-60k'
                    WHEN income_annual_usd < 100000 THEN '60-100k'
                    WHEN income_annual_usd < 200000 THEN '100-200k'
                    ELSE '>200k'
                  END AS income_bucket,
                  COUNT(*) AS account_count
                FROM `{self.bq_project}.{self.bq_dataset}.cc_customers`
                {segment_filter}
                GROUP BY 1, 2, 3, 4
                ORDER BY 6 DESC
            """
            return self._bq_query(sql)

        df = self._parquet("customers/customers.parquet", columns=["state", "date_of_birth", "employment_type", "income_annual_usd"])
        if df.empty:
            return df
        if segment:
            df = df[df["employment_type"] == segment]
        today = pd.Timestamp.today()
        df["age"] = (today - pd.to_datetime(df["date_of_birth"])).dt.days // 365
        bins = [18, 25, 35, 45, 55, 65, 200]
        labels = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        df["age_band"] = pd.cut(df["age"], bins=bins, labels=labels, right=False)
        df["income_bucket"] = pd.cut(
            df["income_annual_usd"],
            bins=[0, 35_000, 60_000, 100_000, 200_000, float("inf")],
            labels=["<35k", "35-60k", "60-100k", "100-200k", ">200k"],
        )
        return (
            df.groupby(["state", "age_band", "employment_type", "income_bucket"], observed=True)
            .size()
            .reset_index(name="account_count")
            .sort_values("account_count", ascending=False)
        )

    def get_spend_by_mcc(self, year: int, month: int, top_n: int = 20) -> pd.DataFrame:
        """Top merchant category codes by spend volume.

        Columns
        -------
        merchant_category_code, total_spend_usd, transaction_count
        """
        if self._resolve_source("transactions") == "bq":
            sql = f"""
                SELECT
                  merchant_category_code,
                  SUM(amount_usd)  AS total_spend_usd,
                  COUNT(*)         AS transaction_count
                FROM `{self.bq_project}.{self.bq_dataset}.cc_transactions`
                WHERE year = {year} AND month = {month}
                  AND transaction_type = 'PURCHASE'
                GROUP BY 1
                ORDER BY 2 DESC
                LIMIT {top_n}
            """
            return self._bq_query(sql)

        df = self._txn_parquet(year, month, columns=["merchant_category_code", "amount_usd", "transaction_type"])
        if df.empty:
            return df
        return (
            df[df["transaction_type"] == "PURCHASE"]
            .groupby("merchant_category_code")
            .agg(total_spend_usd=("amount_usd", "sum"), transaction_count=("amount_usd", "count"))
            .sort_values("total_spend_usd", ascending=False)
            .head(top_n)
            .reset_index()
        )

    def get_credit_limit_event_summary(self, year: int) -> pd.DataFrame:
        """Annual CLI/CLD event counts and average limit changes.

        Columns
        -------
        event_type, trigger, event_count, avg_limit_change_usd
        """
        if self._resolve_source("credit_limit_events") == "bq":
            sql = f"""
                SELECT
                  event_type,
                  trigger,
                  COUNT(*)                              AS event_count,
                  AVG(new_limit_usd - previous_limit_usd) AS avg_limit_change_usd
                FROM `{self.bq_project}.{self.bq_dataset}.cc_credit_limit_events`
                WHERE EXTRACT(YEAR FROM event_date) = {year}
                GROUP BY 1, 2
                ORDER BY 3 DESC
            """
            return self._bq_query(sql)

        df = self._parquet("cc_credit_limit_events/cc_credit_limit_events.parquet",
                           columns=["event_date", "event_type", "trigger", "previous_limit_usd", "new_limit_usd"])
        if df.empty:
            return df
        df["event_date"] = pd.to_datetime(df["event_date"])
        df = df[df["event_date"].dt.year == year]
        df["limit_change"] = df["new_limit_usd"] - df["previous_limit_usd"]
        return (
            df.groupby(["event_type", "trigger"])
            .agg(event_count=("limit_change", "count"), avg_limit_change_usd=("limit_change", "mean"))
            .sort_values("event_count", ascending=False)
            .reset_index()
        )


# --------------------------------------------------------------------------
# Module-level singleton
# --------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_cc_adapter() -> CreditCardAdapter:
    """Return the module-level singleton adapter (cached)."""
    return CreditCardAdapter()


# --------------------------------------------------------------------------
# Module-level convenience loaders (called by aggregator.py)
# --------------------------------------------------------------------------

def load_cc_accounts() -> pd.DataFrame:
    """Load CC originations / accounts into a flat DataFrame.

    Returns ``cc_originations/cc_originations.parquet`` when available,
    otherwise an empty DataFrame with the expected schema.
    """
    adapter = get_cc_adapter()
    df = adapter._parquet(
        "cc_originations/cc_originations.parquet",
        columns=None,
    )
    if df.empty:
        return pd.DataFrame(
            columns=["account_id", "credit_limit", "interest_rate", "risk_segment", "channel", "open_date"]
        )
    return df


def load_cc_pd_scores() -> pd.DataFrame:
    """Load PD scores DataFrame.

    Tries ``pd_scores/pd_scores.parquet``; if absent, derives a minimal
    DataFrame from the originations file (with null pd_score / default_flag).
    """
    adapter = get_cc_adapter()
    df = adapter._parquet("pd_scores/pd_scores.parquet")
    if not df.empty:
        return df

    # Derive stub from originations so account_id column is present
    base = adapter._parquet("cc_originations/cc_originations.parquet", columns=["account_id"])
    if base.empty:
        return pd.DataFrame(columns=["account_id", "pd_score", "default_flag", "risk_segment"])
    base["pd_score"] = None
    base["default_flag"] = None
    base["risk_segment"] = None
    return base


def load_cc_txn_summary() -> pd.DataFrame:
    """Aggregate all credit-card transaction parquet partitions into one summary.

    Scans ``cc_transactions/year=*/month=*/transactions.parquet`` and
    concatenates them.  Returns an empty DataFrame on failure.
    """
    adapter = get_cc_adapter()
    txn_root = adapter.parquet_root / "cc_transactions"
    if not txn_root.exists():
        return pd.DataFrame(columns=["account_id", "period", "interest_charged", "fees_charged", "statement_balance"])

    parts: list[pd.DataFrame] = []
    for parquet_file in sorted(txn_root.rglob("*.parquet")):
        try:
            parts.append(pd.read_parquet(parquet_file))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to read %s: %s", parquet_file, exc)

    if not parts:
        return pd.DataFrame(columns=["account_id", "period", "interest_charged", "fees_charged", "statement_balance"])

    df = pd.concat(parts, ignore_index=True)
    return df


def load_cc_cost_assumptions() -> pd.DataFrame:
    """Load cost assumptions DataFrame.

    Tries ``cost_assumptions/cost_assumptions.parquet``; falls back to a
    single-row DataFrame with illustrative dev defaults.
    """
    adapter = get_cc_adapter()
    df = adapter._parquet("cost_assumptions/cost_assumptions.parquet")
    if not df.empty:
        return df

    # Fallback: hard-coded dev defaults
    return pd.DataFrame([{
        "cost_of_funds_rate": 0.045,   # 4.5% CoF
        "acquisition_cost_avg": 85.0,  # £85 avg acquisition cost
    }])


# --------------------------------------------------------------------------
# Internal helper — load BQ client without importing at module level
# --------------------------------------------------------------------------

def _load_bq_client() -> Any | None:
    try:
        from app.shared.bigquery_client import get_bq_client
        return get_bq_client()
    except Exception:
        return None
