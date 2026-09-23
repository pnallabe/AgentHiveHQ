"""
Test Suite: Zero Lookahead Bias & Temporal Leakage Prevention.
Asserts that feature values calculated as of timestamp T do NOT change when post-T records are appended to the dataset.
"""

from datetime import datetime, timedelta
import pytest
import pandas as pd

from agenthive_data.transformations.gold_features import GoldFeatureExtractor


def test_zero_lookahead_leakage_guarantee():
    """Asserts that post-cutoff events do not leak into feature calculation at timestamp T."""
    extractor = GoldFeatureExtractor(tenant_id="tenant_alpha")

    cutoff_t = datetime(2024, 6, 1, 12, 0, 0)
    post_cutoff_t = datetime(2024, 6, 2, 12, 0, 0)

    # 1. Base dataset prior to cutoff
    apps_base = pd.DataFrame([
        {
            "application_id": "APP_001",
            "applicant_id": "CUST_001",
            "tenant_id": "tenant_alpha",
            "as_of_date": datetime(2024, 5, 15, 10, 0, 0),
            "annual_income": 120000.0,
            "housing_cost_monthly": 2000.0,
        }
    ])

    bureau_base = pd.DataFrame([
        {
            "bureau_report_id": "BUR_001",
            "applicant_id": "CUST_001",
            "tenant_id": "tenant_alpha",
            "as_of_date": datetime(2024, 5, 14, 0, 0, 0),
            "fico_score": 720,
            "revolving_utilization_rate": 25.0,
            "total_inquiries_last_6m": 1,
        }
    ])

    # Feature matrix computed at T
    feats_t = extractor.extract_consumer_underwriting_features(apps_base, bureau_base, as_of_cutoff=cutoff_t)
    assert not feats_t.empty
    fico_t = feats_t.iloc[0]["gold_feat_fico_score"]
    assert fico_t == 720

    # 2. Append post-cutoff record (e.g. FICO score drop to 550 on June 2)
    bureau_with_leak = pd.concat([
        bureau_base,
        pd.DataFrame([
            {
                "bureau_report_id": "BUR_002_POST",
                "applicant_id": "CUST_001",
                "tenant_id": "tenant_alpha",
                "as_of_date": post_cutoff_t,
                "fico_score": 550,  # Post-cutoff drop
                "revolving_utilization_rate": 95.0,
                "total_inquiries_last_6m": 8,
            }
        ])
    ], ignore_index=True)

    # Re-evaluate features at cutoff T with future data present
    feats_reevaluated = extractor.extract_consumer_underwriting_features(apps_base, bureau_with_leak, as_of_cutoff=cutoff_t)
    fico_reevaluated = feats_reevaluated.iloc[0]["gold_feat_fico_score"]

    # ASSERTION: The post-cutoff drop MUST NOT affect the feature extracted as of T
    assert fico_reevaluated == fico_t
    assert fico_reevaluated == 720


def test_multi_tenant_isolation_in_features():
    """Asserts that queries scoped to tenant_alpha strictly exclude tenant_beta records."""
    extractor = GoldFeatureExtractor(tenant_id="tenant_alpha")
    cutoff_t = datetime(2024, 6, 1, 12, 0, 0)

    apps = pd.DataFrame([
        {
            "application_id": "APP_ALPHA",
            "applicant_id": "CUST_1",
            "tenant_id": "tenant_alpha",
            "as_of_date": datetime(2024, 5, 15),
            "annual_income": 100000.0,
            "housing_cost_monthly": 1500.0,
        },
        {
            "application_id": "APP_BETA",
            "applicant_id": "CUST_2",
            "tenant_id": "tenant_beta",
            "as_of_date": datetime(2024, 5, 15),
            "annual_income": 200000.0,
            "housing_cost_monthly": 3000.0,
        }
    ])

    bureau = pd.DataFrame([
        {
            "bureau_report_id": "BUR_1",
            "applicant_id": "CUST_1",
            "tenant_id": "tenant_alpha",
            "as_of_date": datetime(2024, 5, 10),
            "fico_score": 750,
            "revolving_utilization_rate": 15.0,
            "total_inquiries_last_6m": 0,
        },
        {
            "bureau_report_id": "BUR_2",
            "applicant_id": "CUST_2",
            "tenant_id": "tenant_beta",
            "as_of_date": datetime(2024, 5, 10),
            "fico_score": 680,
            "revolving_utilization_rate": 45.0,
            "total_inquiries_last_6m": 2,
        }
    ])

    feats = extractor.extract_consumer_underwriting_features(apps, bureau, as_of_cutoff=cutoff_t)
    assert len(feats) == 1
    assert feats.iloc[0]["application_id"] == "APP_ALPHA"
    assert feats.iloc[0]["tenant_id_app"] == "tenant_alpha"
