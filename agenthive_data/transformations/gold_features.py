"""
Gold Point-in-Time Feature Engineering & Store Transformed Marts.
Executes temporal AS-OF joins guaranteeing ZERO lookahead bias across credit applications, bureau reports, and longitudinal performance panels.
"""

from datetime import datetime, date
from typing import List, Dict, Any, Optional
import pandas as pd


class GoldFeatureExtractor:
    """Point-in-Time feature engineering pipeline for Gold analytical feature stores."""

    def __init__(self, tenant_id: str = "tenant_default"):
        self.tenant_id = tenant_id

    def extract_consumer_underwriting_features(
        self,
        application_df: pd.DataFrame,
        bureau_df: pd.DataFrame,
        as_of_cutoff: datetime,
    ) -> pd.DataFrame:
        """Computes point-in-time underwriting features cut off strictly at `as_of_cutoff`.

        Zero Lookahead Guarantee: Filter out any record with timestamp > as_of_cutoff.
        """
        if application_df.empty or bureau_df.empty:
            return pd.DataFrame()

        # Enforce multi-tenant filter & strict temporal cutoff
        apps_filtered = application_df[
            (application_df["tenant_id"] == self.tenant_id) &
            (pd.to_datetime(application_df["as_of_date"]) <= as_of_cutoff)
        ].copy()

        bureau_filtered = bureau_df[
            (bureau_df["tenant_id"] == self.tenant_id) &
            (pd.to_datetime(bureau_df["as_of_date"]) <= as_of_cutoff)
        ].copy()

        if apps_filtered.empty or bureau_filtered.empty:
            return pd.DataFrame()

        # Sort for AS-OF join
        apps_filtered["as_of_dt"] = pd.to_datetime(apps_filtered["as_of_date"])
        bureau_filtered["as_of_dt"] = pd.to_datetime(bureau_filtered["as_of_date"])

        apps_sorted = apps_filtered.sort_values("as_of_dt")
        bureau_sorted = bureau_filtered.sort_values("as_of_dt")

        # Perform AS-OF Join on applicant_id matching closest record ON OR BEFORE application cutoff
        merged = pd.merge_asof(
            apps_sorted,
            bureau_sorted,
            on="as_of_dt",
            by="applicant_id",
            direction="backward",
            suffixes=("_app", "_bureau"),
        )

        # Feature Engineering (Gold Features)
        merged["gold_feat_fico_score"] = merged["fico_score"]
        merged["gold_feat_dti_pct"] = (merged["housing_cost_monthly"] / (merged["annual_income"] / 12.0).replace(0, 1) * 100.0).round(2)
        merged["gold_feat_revolving_utilization"] = merged["revolving_utilization_rate"]
        merged["gold_feat_inquiries_6m"] = merged["total_inquiries_last_6m"]
        merged["gold_feat_is_subprime"] = merged["fico_score"] < 620
        merged["gold_feat_as_of_cutoff"] = as_of_cutoff.isoformat()

        return merged

    def extract_longitudinal_cecl_features(
        self,
        performance_df: pd.DataFrame,
        as_of_date: date,
    ) -> pd.DataFrame:
        """Extracts monthly roll-rate & lifetime loss features as of a given reporting month cutoff."""
        if performance_df.empty:
            return pd.DataFrame()

        # Filter strictly on or before as_of_date
        perf_filtered = performance_df[
            (performance_df["tenant_id"] == self.tenant_id) &
            (pd.to_datetime(performance_df["as_of_date"]).dt.date <= as_of_date)
        ].copy()

        if perf_filtered.empty:
            return pd.DataFrame()

        # Group by loan_id to get latest historical status prior to cutoff
        latest_status = perf_filtered.sort_values("as_of_date").groupby("loan_id").last().reset_index()

        latest_status["cecl_as_of_cutoff"] = as_of_date.isoformat()
        latest_status["is_ever_30_dq"] = latest_status["loan_id"].isin(
            perf_filtered[perf_filtered["delinquency_status"].isin(["1", "2", "3", "4", "C"])]["loan_id"]
        )

        return latest_status
