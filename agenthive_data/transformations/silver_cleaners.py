"""
Medallion Silver Transformation Module.
Standardizes raw Bronze JSON/event payloads into clean relational DataFrames and DuckDB tables.
"""

from datetime import datetime
from typing import List, Dict, Any
import pandas as pd

from agenthive_data.schemas.application import ConsumerApplication, CommercialApplication
from agenthive_data.schemas.bureau import BureauReport


class SilverCleaners:
    """Transformation functions for cleaning and standardizing Bronze raw data into Silver schema."""

    @staticmethod
    def clean_consumer_applications(raw_records: List[Dict[str, Any]]) -> pd.DataFrame:
        """Standardizes consumer application raw payloads into Silver relational format."""
        if not raw_records:
            return pd.DataFrame()

        df = pd.DataFrame(raw_records)

        # Standardize column types & fill defaults
        df["tenant_id"] = df["tenant_id"].astype(str)
        df["annual_income"] = df["annual_income"].astype(float).clip(lower=0.0)
        df["housing_cost_monthly"] = df["housing_cost_monthly"].astype(float).clip(lower=0.0)
        df["requested_amount"] = df["requested_amount"].astype(float).clip(lower=0.0)
        df["requested_term_months"] = df["requested_term_months"].astype(int)

        # Calculate standardized Debt-To-Income (DTI) ratio
        monthly_income = (df["annual_income"] / 12.0).replace(0, 1.0)
        df["calculated_dti_pct"] = (df["housing_cost_monthly"] / monthly_income * 100.0).round(2)

        # Add Silver processing audit columns
        df["silver_cleaned_at"] = datetime.utcnow().isoformat()
        return df

    @staticmethod
    def clean_bureau_reports(raw_reports: List[Dict[str, Any]]) -> pd.DataFrame:
        """Standardizes raw credit bureau reports into Silver relational table format."""
        if not raw_reports:
            return pd.DataFrame()

        df = pd.DataFrame(raw_reports)
        df["tenant_id"] = df["tenant_id"].astype(str)
        df["fico_score"] = df["fico_score"].astype(int).clip(lower=300, upper=850)
        df["revolving_utilization_rate"] = df["revolving_utilization_rate"].astype(float).clip(lower=0.0, upper=100.0)
        df["silver_cleaned_at"] = datetime.utcnow().isoformat()
        return df
