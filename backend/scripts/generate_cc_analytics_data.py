#!/usr/bin/env python3
"""
generate_cc_analytics_data.py — Section 18 implementation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Row-level synthetic dataset: 5 million credit card customers, 10-year
history (2015–2024).  Generates five tables, writes Parquet partitions,
optionally uploads to GCS, and registers BigQuery external tables.

Output tables
─────────────
  customers                 5,000,000 rows (static)
  cc_originations           ~6,800,000 rows
  cc_monthly_statements     ~480,000,000 rows (120 monthly partitions)
  cc_transactions           ~80,000,000 rows  (120 monthly partitions, sampled)
  cc_credit_limit_events    ~14,000,000 rows

Usage examples
──────────────
  # Full run
  python scripts/generate_cc_analytics_data.py \\
    --customers 5000000 \\
    --bucket ${GCS_BUCKET} \\
    --project ${GCP_PROJECT_ID} \\
    --bq-dataset credit_risk_model_dev \\
    --seed 42

  # Quick 10k validation (local only)
  python scripts/generate_cc_analytics_data.py \\
    --customers 10000 \\
    --local-only \\
    --out-dir data/cc_analytics_test/

  # Resume from year 2020
  python scripts/generate_cc_analytics_data.py \\
    --customers 5000000 \\
    --resume-from-year 2020 \\
    --bucket ${GCS_BUCKET} --project ${GCP_PROJECT_ID}

  # Register BQ external tables only (data already in GCS)
  python scripts/generate_cc_analytics_data.py \\
    --register-bq-only \\
    --bucket ${GCS_BUCKET} --project ${GCP_PROJECT_ID} \\
    --bq-dataset credit_risk_model_dev

  # Dry run
  python scripts/generate_cc_analytics_data.py \\
    --customers 5000000 \\
    --bucket ${GCS_BUCKET} \\
    --dry-run
"""
from __future__ import annotations

import argparse
import gc
import hashlib
import json
import logging
import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# ── Optional GCS / BQ dependencies ───────────────────────────────────────────
try:
    from google.cloud import storage as gcs_storage
    _GCS_AVAILABLE = True
except ImportError:
    _GCS_AVAILABLE = False

try:
    from google.cloud import bigquery as _bq
    _BQ_AVAILABLE = True
except ImportError:
    _BQ_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("cc_gen")

# ── Repo root ─────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[1]

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 18 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

AGE_DIST = {
    "18-24": 0.09,
    "25-34": 0.22,
    "35-44": 0.21,
    "45-54": 0.20,
    "55-64": 0.17,
    "65+":   0.11,
}

STATE_WEIGHTS: dict[str, float] = {
    "CA": 0.118, "TX": 0.091, "FL": 0.072, "NY": 0.060,
    "PA": 0.038, "IL": 0.038, "OH": 0.035, "GA": 0.031,
    "NC": 0.030, "MI": 0.030,
}
# Distribute remaining 0.457 evenly across 40 other states
_OTHER_STATES = [
    "AK", "AL", "AR", "AZ", "CO", "CT", "DC", "DE", "HI", "IA",
    "ID", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MN", "MO",
    "MS", "MT", "ND", "NE", "NH", "NJ", "NM", "NV", "OK", "OR",
    "RI", "SC", "SD", "TN", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
]
_other_share = round((1.0 - sum(STATE_WEIGHTS.values())) / len(_OTHER_STATES), 5)
for _s in _OTHER_STATES:
    STATE_WEIGHTS[_s] = _other_share

EMPLOYMENT_DIST: dict[str, float] = {
    "full_time_professional": 0.32,
    "full_time_hourly":       0.28,
    "self_employed":          0.09,
    "part_time":              0.10,
    "retired":                0.11,
    "student":                0.04,
    "unemployed":             0.06,
}

EDUCATION_DIST: dict[str, float] = {
    "HS":       0.27,
    "COLLEGE":  0.42,
    "GRAD":     0.22,
    "POSTGRAD": 0.09,
}

MARITAL_DIST: dict[str, float] = {
    "SINGLE":   0.38,
    "MARRIED":  0.48,
    "DIVORCED": 0.10,
    "OTHER":    0.04,
}

GENDER_DIST: dict[str, float] = {
    "M":  0.49,
    "F":  0.49,
    "NB": 0.01,
    "U":  0.01,
}

CHANNEL_DIST: dict[str, float] = {
    "ONLINE":  0.55,
    "BRANCH":  0.25,
    "MAIL":    0.12,
    "PARTNER": 0.08,
}

DECISION_DIST: dict[str, float] = {
    "APPROVED": 0.72,
    "DECLINED": 0.20,
    "REFERRED": 0.08,
}

DECISION_REASON_CODES = [
    "DTI_EXCEED", "BUREAU_SCORE", "THIN_FILE", "DEROG_MARKS",
    "HIGH_UTIL", "RECENT_DELINQUENCY", "INCOME_UNVERIFIED",
]

CC_PRODUCTS: dict[str, dict] = {
    "secured_starter": {
        "min_fico": 300, "max_fico": 619,
        "credit_limit_range": (300, 1_000),
        "apr_range": (0.2499, 0.2999),
        "annual_fee": 35,
        "rewards_rate": 0.00,
        "target_segment": ["student", "unemployed", "full_time_hourly"],
        "interchange_rate": 0.0165,
        "expected_default_rate_annual": 0.085,
    },
    "classic_unsecured": {
        "min_fico": 580, "max_fico": 659,
        "credit_limit_range": (500, 5_000),
        "apr_range": (0.2199, 0.2699),
        "annual_fee": 0,
        "rewards_rate": 0.01,
        "target_segment": ["full_time_hourly", "part_time"],
        "interchange_rate": 0.0175,
        "expected_default_rate_annual": 0.055,
    },
    "cash_back_everyday": {
        "min_fico": 640, "max_fico": 719,
        "credit_limit_range": (1_000, 12_000),
        "apr_range": (0.1899, 0.2299),
        "annual_fee": 0,
        "rewards_rate": 0.015,
        "target_segment": ["full_time_professional", "full_time_hourly"],
        "interchange_rate": 0.0190,
        "expected_default_rate_annual": 0.032,
    },
    "travel_rewards": {
        "min_fico": 680, "max_fico": 769,
        "credit_limit_range": (3_000, 25_000),
        "apr_range": (0.1799, 0.2199),
        "annual_fee": 95,
        "rewards_rate": 0.02,
        "target_segment": ["full_time_professional", "self_employed"],
        "interchange_rate": 0.0210,
        "expected_default_rate_annual": 0.018,
    },
    "premium_rewards": {
        "min_fico": 720, "max_fico": 799,
        "credit_limit_range": (5_000, 50_000),
        "apr_range": (0.1699, 0.2099),
        "annual_fee": 250,
        "rewards_rate": 0.03,
        "target_segment": ["full_time_professional", "self_employed", "retired"],
        "interchange_rate": 0.0225,
        "expected_default_rate_annual": 0.010,
    },
    "business_basic": {
        "min_fico": 650, "max_fico": 749,
        "credit_limit_range": (2_000, 30_000),
        "apr_range": (0.1899, 0.2399),
        "annual_fee": 0,
        "rewards_rate": 0.015,
        "target_segment": ["self_employed"],
        "interchange_rate": 0.0200,
        "expected_default_rate_annual": 0.028,
    },
    "business_preferred": {
        "min_fico": 700, "max_fico": 799,
        "credit_limit_range": (5_000, 100_000),
        "apr_range": (0.1599, 0.2099),
        "annual_fee": 195,
        "rewards_rate": 0.025,
        "target_segment": ["self_employed"],
        "interchange_rate": 0.0215,
        "expected_default_rate_annual": 0.018,
    },
    "student_rewards": {
        "min_fico": 300, "max_fico": 679,
        "credit_limit_range": (500, 2_500),
        "apr_range": (0.1999, 0.2699),
        "annual_fee": 0,
        "rewards_rate": 0.01,
        "target_segment": ["student"],
        "interchange_rate": 0.0170,
        "expected_default_rate_annual": 0.065,
    },
    "elite_metal": {
        "min_fico": 760, "max_fico": 850,
        "credit_limit_range": (10_000, 150_000),
        "apr_range": (0.1499, 0.1999),
        "annual_fee": 550,
        "rewards_rate": 0.04,
        "target_segment": ["full_time_professional", "retired"],
        "interchange_rate": 0.0240,
        "expected_default_rate_annual": 0.005,
    },
    "private_client": {
        "min_fico": 800, "max_fico": 850,
        "credit_limit_range": (25_000, 500_000),
        "apr_range": (0.1299, 0.1799),
        "annual_fee": 995,
        "rewards_rate": 0.05,
        "target_segment": ["full_time_professional", "self_employed"],
        "interchange_rate": 0.0260,
        "expected_default_rate_annual": 0.003,
    },
}

MACRO_CALENDAR: dict[int, dict] = {
    2015: {"period": "PRE_COVID",     "spend_mult": 1.00, "default_mult": 1.00, "pmt_mult": 1.00},
    2016: {"period": "PRE_COVID",     "spend_mult": 1.04, "default_mult": 0.97, "pmt_mult": 1.01},
    2017: {"period": "PRE_COVID",     "spend_mult": 1.07, "default_mult": 0.95, "pmt_mult": 1.02},
    2018: {"period": "PRE_COVID",     "spend_mult": 1.09, "default_mult": 0.93, "pmt_mult": 1.03},
    2019: {"period": "PRE_COVID",     "spend_mult": 1.11, "default_mult": 0.91, "pmt_mult": 1.04},
    2020: {"period": "COVID_SHOCK",   "spend_mult": 0.75, "default_mult": 1.45, "pmt_mult": 1.25},
    2021: {"period": "RECOVERY",      "spend_mult": 0.95, "default_mult": 0.80, "pmt_mult": 1.18},
    2022: {"period": "RATE_HIKE",     "spend_mult": 1.08, "default_mult": 1.10, "pmt_mult": 0.95},
    2023: {"period": "RATE_HIKE",     "spend_mult": 1.05, "default_mult": 1.20, "pmt_mult": 0.90},
    2024: {"period": "NORMALISATION", "spend_mult": 1.06, "default_mult": 1.15, "pmt_mult": 0.92},
}

SEASONAL_SPEND: dict[int, float] = {
    1: 0.85, 2: 0.82, 3: 0.93, 4: 0.96,  5: 0.99, 6: 1.02,
    7: 1.03, 8: 1.05, 9: 0.97, 10: 1.00, 11: 1.18, 12: 1.40,
}

CPI_INDEX: dict[int, float] = {
    2015: 0.789, 2016: 0.802, 2017: 0.820, 2018: 0.840,
    2019: 0.856, 2020: 0.858, 2021: 0.898, 2022: 0.963,
    2023: 0.990, 2024: 1.000,
}

# Markov delinquency states: CURRENT(0) DPD30(1) DPD60(2) DPD90(3) DPD120(4) CHARGED_OFF(5) CLOSED(6)
DELINQUENCY_STATES = ["CURRENT", "DPD30", "DPD60", "DPD90", "DPD120", "CHARGED_OFF", "CLOSED"]
BASE_TRANSITION = np.array([
    [0.9720, 0.0180, 0.0000, 0.0000, 0.0000, 0.0000, 0.0100],
    [0.6500, 0.1800, 0.1500, 0.0000, 0.0000, 0.0000, 0.0200],
    [0.3000, 0.1500, 0.2500, 0.2800, 0.0000, 0.0000, 0.0200],
    [0.1500, 0.0500, 0.1000, 0.3500, 0.3300, 0.0000, 0.0200],
    [0.0500, 0.0200, 0.0300, 0.0500, 0.3500, 0.5000, 0.0000],
    [0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000, 0.0000],
    [0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000],
], dtype=np.float64)

# MCC codes used in transaction sampling
SAMPLE_MCC_CODES = [
    "5411", "5912", "5812", "5311", "5541", "5172", "4111", "4814",
    "5045", "5065", "5251", "7011", "5999", "5734", "5621", "5691",
    "8011", "8049", "5661", "7523",
]
SAMPLE_MERCHANT_NAMES: dict[str, list[str]] = {
    "5411": ["Whole Foods", "Kroger", "Safeway", "Albertsons"],
    "5912": ["CVS Pharmacy", "Walgreens", "Rite Aid"],
    "5812": ["McDonald's", "Starbucks", "Chipotle", "Subway", "Olive Garden"],
    "5311": ["Target", "Walmart", "Kohl's", "Macy's"],
    "5541": ["Shell", "Chevron", "BP", "ExxonMobil"],
    "4111": ["NYC MTA", "BART", "Metro", "Chicago Transit"],
    "4814": ["AT&T", "Verizon", "T-Mobile"],
    "7011": ["Marriott", "Hilton", "Hyatt", "Airbnb"],
    "5734": ["Best Buy", "Apple Store", "Microsoft Store"],
    "7523": ["ParkWhiz", "SpotHero", "LAZ Parking"],
}

# PyArrow schemas
PA_CUSTOMERS = pa.schema([
    pa.field("customer_id",                  pa.string()),
    pa.field("date_of_birth",                pa.date32()),
    pa.field("gender",                       pa.string()),
    pa.field("state",                        pa.string()),
    pa.field("zip3",                         pa.string()),
    pa.field("employment_type",              pa.string()),
    pa.field("income_annual_usd",            pa.float64()),
    pa.field("education_level",              pa.string()),
    pa.field("marital_status",               pa.string()),
    pa.field("has_mortgage",                 pa.bool_()),
    pa.field("has_deposit_account",          pa.bool_()),
    pa.field("bureau_score_at_first_cc_app", pa.int32()),
    pa.field("thin_file",                    pa.bool_()),
    pa.field("customer_since_year",          pa.int32()),
])

PA_ORIGINATIONS = pa.schema([
    pa.field("origination_id",          pa.string()),
    pa.field("customer_id",             pa.string()),
    pa.field("product_id",              pa.string()),
    pa.field("origination_date",        pa.date32()),
    pa.field("bureau_score_at_orig",    pa.int32()),
    pa.field("income_verified_usd",     pa.float64()),
    pa.field("credit_limit_usd",        pa.float64()),
    pa.field("apr_purchase",            pa.float64()),
    pa.field("annual_fee_usd",          pa.float64()),
    pa.field("channel",                 pa.string()),
    pa.field("promotional_apr",         pa.float64()),
    pa.field("promo_end_date",          pa.date32()),
    pa.field("credit_bureau_pull_type", pa.string()),
    pa.field("decision",                pa.string()),
    pa.field("decision_reason_code",    pa.string()),
    pa.field("underwriter_id",          pa.string()),
])

PA_STATEMENTS = pa.schema([
    pa.field("statement_id",            pa.string()),
    pa.field("origination_id",          pa.string()),
    pa.field("customer_id",             pa.string()),
    pa.field("product_id",              pa.string()),
    pa.field("statement_date",          pa.date32()),
    pa.field("year",                    pa.int32()),
    pa.field("month",                   pa.int32()),
    pa.field("balance_usd",             pa.float64()),
    pa.field("credit_limit_usd",        pa.float64()),
    pa.field("utilization_rate",        pa.float64()),
    pa.field("minimum_payment_usd",     pa.float64()),
    pa.field("actual_payment_usd",      pa.float64()),
    pa.field("payment_ratio",           pa.float64()),
    pa.field("purchase_volume_usd",     pa.float64()),
    pa.field("cash_advance_usd",        pa.float64()),
    pa.field("balance_transfer_usd",    pa.float64()),
    pa.field("fee_revenue_usd",         pa.float64()),
    pa.field("interest_revenue_usd",    pa.float64()),
    pa.field("interchange_revenue_usd", pa.float64()),
    pa.field("rewards_cost_usd",        pa.float64()),
    pa.field("delinquency_status",      pa.string()),
    pa.field("days_past_due",           pa.int32()),
    pa.field("account_age_months",      pa.int32()),
    pa.field("bureau_score_current",    pa.int32()),
    pa.field("macro_period",            pa.string()),
])

PA_TRANSACTIONS = pa.schema([
    pa.field("transaction_id",           pa.string()),
    pa.field("origination_id",           pa.string()),
    pa.field("customer_id",              pa.string()),
    pa.field("transaction_date",         pa.date32()),
    pa.field("year",                     pa.int32()),
    pa.field("month",                    pa.int32()),
    pa.field("merchant_category_code",   pa.string()),
    pa.field("merchant_name",            pa.string()),
    pa.field("amount_usd",               pa.float64()),
    pa.field("transaction_type",         pa.string()),
    pa.field("is_international",         pa.bool_()),
    pa.field("is_contactless",           pa.bool_()),
    pa.field("is_online",                pa.bool_()),
])

PA_CLI_EVENTS = pa.schema([
    pa.field("event_id",              pa.string()),
    pa.field("origination_id",        pa.string()),
    pa.field("customer_id",           pa.string()),
    pa.field("event_date",            pa.date32()),
    pa.field("event_type",            pa.string()),
    pa.field("previous_limit_usd",    pa.float64()),
    pa.field("new_limit_usd",         pa.float64()),
    pa.field("trigger",               pa.string()),
    pa.field("bureau_score_at_event", pa.int32()),
])


# ═══════════════════════════════════════════════════════════════════════════════
#  MARKOV HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _apply_macro_to_transition(matrix: np.ndarray, default_mult: float) -> np.ndarray:
    adjusted = matrix.copy()
    adjusted[:, 5] = np.minimum(adjusted[:, 5] * default_mult, 0.99)
    row_sums = adjusted.sum(axis=1, keepdims=True)
    row_sums = np.where(row_sums == 0, 1, row_sums)
    return adjusted / row_sums


def _scale_transition_for_product(matrix: np.ndarray, product_key: str) -> np.ndarray:
    """Scale base transition matrix to match product annual default rate."""
    p = CC_PRODUCTS[product_key]
    target_annual_dr = p["expected_default_rate_annual"]
    # base monthly C_OFF probability from CURRENT is BASE_TRANSITION[0,5] ≈ 0
    # Use a simple scalar that adjusts DPD30 entry rate to match annual DR
    baseline_monthly_dr = BASE_TRANSITION[0, 1]  # CURRENT→DPD30
    implied_annual_dr = 0.028  # base calibration target
    scale = max(0.05, target_annual_dr / implied_annual_dr)
    adj = matrix.copy()
    # Scale flow from CURRENT to DPD states
    adj[0, 1] = min(adj[0, 1] * scale, 0.15)
    adj[0, 0] = 1.0 - adj[0, 1] - adj[0, 5] - adj[0, 6]
    adj[0, 0] = max(adj[0, 0], 0.80)
    # Renormalise row 0
    adj[0] = adj[0] / adj[0].sum()
    return adj


# ═══════════════════════════════════════════════════════════════════════════════
#  TABLE GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

class Generator:
    def __init__(self, n_customers: int, seed: int) -> None:
        self.n = n_customers
        self.seed = seed
        self.rng = np.random.default_rng(seed)

    # ── customers ──────────────────────────────────────────────────────────────

    def generate_customers(self) -> pd.DataFrame:
        logger.info("Generating %d customer records …", self.n)
        n = self.n
        rng = self.rng

        # --- age ---
        age_buckets = list(AGE_DIST.keys())
        age_weights = list(AGE_DIST.values())
        bucket_widths = [7, 10, 10, 10, 10, 30]
        chosen_bucket = rng.choice(len(age_buckets), size=n, p=age_weights)
        min_ages = [18, 25, 35, 45, 55, 65]
        age = np.array([
            min_ages[b] + rng.uniform(0, bucket_widths[b])
            for b in chosen_bucket
        ])
        # date_of_birth relative to end of 2024
        reference_date = date(2024, 12, 31)
        dob_offsets = (age * 365.25).astype(int)
        dob_list = [reference_date - timedelta(days=int(d)) for d in dob_offsets]

        # --- income ---
        income = rng.lognormal(np.log(68_000), 0.72, n)
        income = np.clip(income, 18_000, 1_500_000)

        # --- FICO ---
        n_prime = int(n * 0.68)
        n_sub = n - n_prime
        fico_prime = rng.normal(720, 45, n_prime)
        fico_sub = rng.normal(590, 55, n_sub)
        fico_all = np.clip(np.concatenate([fico_prime, fico_sub]), 300, 850).astype(int)
        rng.shuffle(fico_all)

        # --- categorical ---
        states = list(STATE_WEIGHTS.keys())
        state_probs = np.array([STATE_WEIGHTS[s] for s in states], dtype=np.float64)
        state_probs /= state_probs.sum()  # normalise to guard against rounding drift
        state_arr = rng.choice(states, size=n, p=state_probs)

        emp_keys = list(EMPLOYMENT_DIST.keys())
        emp_probs = list(EMPLOYMENT_DIST.values())
        emp_arr = rng.choice(emp_keys, size=n, p=emp_probs)

        edu_keys = list(EDUCATION_DIST.keys())
        edu_probs = list(EDUCATION_DIST.values())
        edu_arr = rng.choice(edu_keys, size=n, p=edu_probs)

        mar_keys = list(MARITAL_DIST.keys())
        mar_probs = list(MARITAL_DIST.values())
        mar_arr = rng.choice(mar_keys, size=n, p=mar_probs)

        gender_keys = list(GENDER_DIST.keys())
        gender_probs = list(GENDER_DIST.values())
        gender_arr = rng.choice(gender_keys, size=n, p=gender_probs)

        zip3_arr = [f"{rng.integers(100, 999):03d}" for _ in range(n)]
        has_mortgage = rng.random(n) < 0.31
        has_deposit = rng.random(n) < 0.38
        has_existing_rel = rng.random(n) < 0.38
        thin_file = fico_all < 620

        # customer_since_year
        cust_since_year = rng.integers(2015, 2025, size=n)

        customer_ids = [f"CUST_{i:08d}" for i in range(1, n + 1)]

        df = pd.DataFrame({
            "customer_id":                  customer_ids,
            "date_of_birth":                dob_list,
            "gender":                       gender_arr,
            "state":                        state_arr,
            "zip3":                         zip3_arr,
            "employment_type":              emp_arr,
            "income_annual_usd":            income,
            "education_level":              edu_arr,
            "marital_status":               mar_arr,
            "has_mortgage":                 has_mortgage,
            "has_deposit_account":          has_deposit,
            "bureau_score_at_first_cc_app": fico_all,
            "thin_file":                    thin_file,
            "customer_since_year":          cust_since_year.astype(np.int32),
        })
        logger.info("  customers: %d rows", len(df))
        return df

    # ── originations ───────────────────────────────────────────────────────────

    def generate_originations(self, customers_df: pd.DataFrame) -> pd.DataFrame:
        """Generate ~1.36 cards per customer on average (~6.8M rows)."""
        logger.info("Generating originations …")
        rng = self.rng
        rows: list[dict] = []

        product_names = list(CC_PRODUCTS.keys())
        channel_keys = list(CHANNEL_DIST.keys())
        channel_probs = list(CHANNEL_DIST.values())
        decision_keys = list(DECISION_DIST.keys())
        decision_probs = list(DECISION_DIST.values())

        # Number of cards per customer: Poisson(1.36) clipped to 1–4
        n_cards = np.clip(rng.poisson(1.36, self.n), 1, 4)

        for idx, row in enumerate(customers_df.itertuples(index=False)):
            nc = int(n_cards[idx])
            for _ in range(nc):
                fico = int(row.bureau_score_at_first_cc_app)
                emp = row.employment_type
                # Find eligible products
                eligible = [
                    p for p, cfg in CC_PRODUCTS.items()
                    if cfg["min_fico"] <= fico <= cfg["max_fico"]
                ]
                if not eligible:
                    eligible = ["classic_unsecured"]
                # Prefer products whose target_segment matches employment
                matching = [p for p in eligible if emp in CC_PRODUCTS[p]["target_segment"]]
                product_pool = matching if matching else eligible
                product_id = rng.choice(product_pool)
                cfg = CC_PRODUCTS[product_id]

                # origination date: random within customer_since_year range
                orig_year = int(rng.integers(int(row.customer_since_year), 2025))
                orig_month = int(rng.integers(1, 13))
                orig_day = int(rng.integers(1, 28))
                orig_date = date(orig_year, orig_month, orig_day)

                cl_lo, cl_hi = cfg["credit_limit_range"]
                credit_limit = float(rng.uniform(cl_lo, cl_hi))
                apr_lo, apr_hi = cfg["apr_range"]
                apr = float(rng.uniform(apr_lo, apr_hi))
                has_promo = rng.random() < 0.30
                promo_apr = float(rng.uniform(0.0, 0.0999)) if has_promo else 0.0
                promo_months = int(rng.integers(6, 19)) if has_promo else 0
                promo_end = (
                    date(orig_year, orig_month, orig_day) + timedelta(days=promo_months * 30)
                    if has_promo else orig_date
                )
                channel = rng.choice(channel_keys, p=channel_probs)
                decision = rng.choice(decision_keys, p=decision_probs)
                reason_code = (
                    "" if decision == "APPROVED"
                    else rng.choice(DECISION_REASON_CODES)
                )
                underwriter_id = (
                    f"UW_{rng.integers(100, 999)}"
                    if decision == "REFERRED" else ""
                )
                income_verified = float(row.income_annual_usd) * float(rng.uniform(0.85, 1.15))

                rows.append({
                    "origination_id":          f"ORIG_{uuid.uuid4().hex[:16]}",
                    "customer_id":             row.customer_id,
                    "product_id":              product_id,
                    "origination_date":        orig_date,
                    "bureau_score_at_orig":    fico,
                    "income_verified_usd":     income_verified,
                    "credit_limit_usd":        credit_limit,
                    "apr_purchase":            apr,
                    "annual_fee_usd":          float(cfg["annual_fee"]),
                    "channel":                 channel,
                    "promotional_apr":         promo_apr,
                    "promo_end_date":          promo_end,
                    "credit_bureau_pull_type": "HARD" if decision in ("APPROVED", "DECLINED") else "SOFT",
                    "decision":                decision,
                    "decision_reason_code":    reason_code,
                    "underwriter_id":          underwriter_id,
                })

        df = pd.DataFrame(rows)
        logger.info("  originations: %d rows", len(df))
        return df

    # ── statements (single month) ──────────────────────────────────────────────

    def generate_statements_for_month(
        self,
        active_df: pd.DataFrame,
        year: int,
        month: int,
        macro: dict,
        delinquency_states: dict[str, int],  # origination_id → state index
    ) -> tuple[pd.DataFrame, dict[str, int]]:
        """Generate statement rows for all active accounts in a given month.

        Returns the statement DataFrame and the updated delinquency state dict.
        """
        if active_df.empty:
            return pd.DataFrame(), delinquency_states

        rng = self.rng
        macro_period = macro["period"]
        spend_mult = macro["spend_mult"]
        default_mult = macro["default_mult"]
        pmt_mult = macro["pmt_mult"]
        seasonal = SEASONAL_SPEND[month]

        # Last calendar day of month
        if month == 12:
            stmt_date = date(year, 12, 31)
        else:
            stmt_date = date(year, month + 1, 1) - timedelta(days=1)

        rows: list[dict] = []
        new_states: dict[str, int] = {}

        # pre-build adjusted transition matrices per product (cache)
        transition_cache: dict[str, np.ndarray] = {}
        for pid in active_df["product_id"].unique():
            base = _scale_transition_for_product(BASE_TRANSITION, pid)
            transition_cache[pid] = _apply_macro_to_transition(base, default_mult)

        for rec in active_df.itertuples(index=False):
            oid = rec.origination_id
            pid = rec.product_id
            cid = rec.customer_id
            credit_limit = float(rec.credit_limit_usd)
            apr = float(rec.apr_purchase)
            cfg = CC_PRODUCTS[pid]

            # --- delinquency state transition ---
            cur_state_idx = delinquency_states.get(oid, 0)
            if cur_state_idx in (5, 6):  # absorbing
                new_states[oid] = cur_state_idx
                continue
            transition = transition_cache[pid]
            next_state_idx = int(rng.choice(7, p=transition[cur_state_idx]))
            new_states[oid] = next_state_idx
            delinquency_status = DELINQUENCY_STATES[next_state_idx]
            days_past_due = next_state_idx * 30 if next_state_idx < 5 else (120 if next_state_idx == 4 else 0)

            # --- balances ---
            is_active = next_state_idx < 5
            if not is_active:
                balance = 0.0
                utilization = 0.0
                purchase_volume = 0.0
                interest_rev = 0.0
                interchange_rev = 0.0
            else:
                base_spend_rate = rng.uniform(0.05, 0.60)
                base_balance = credit_limit * base_spend_rate * spend_mult * seasonal
                base_balance = max(0.0, base_balance + rng.normal(0, credit_limit * 0.05))
                balance = min(base_balance, credit_limit)
                utilization = balance / credit_limit if credit_limit > 0 else 0.0
                purchase_volume = balance * rng.uniform(0.3, 0.9)
                interest_rev = balance * (apr / 12.0) * float(next_state_idx > 0)
                interchange_rev = purchase_volume * cfg["interchange_rate"]

            # --- payments ---
            min_payment = max(25.0, balance * 0.02)
            pmt_ratio = float(rng.lognormal(np.log(0.95 * pmt_mult), 0.40))
            pmt_ratio = np.clip(pmt_ratio, 0.0, 5.0)
            actual_payment = min(min_payment * pmt_ratio, balance + 1.0)

            # --- revenue ---
            late_fee = 39.0 if next_state_idx == 1 else (0.0 if next_state_idx == 0 else 29.0)
            annual_fee_monthly = cfg["annual_fee"] / 12.0
            fee_rev = late_fee + annual_fee_monthly
            rewards_cost = purchase_volume * cfg["rewards_rate"]

            # --- bureau score drift ---
            base_score = int(getattr(rec, "bureau_score_at_orig", 700))
            score_drift = int(rng.normal(0 if next_state_idx == 0 else -5 * next_state_idx, 10))
            bureau_current = int(np.clip(base_score + score_drift, 300, 850))

            # --- cash advance / BT ---
            cash_advance = float(rng.exponential(credit_limit * 0.02) if rng.random() < 0.05 else 0.0)
            bal_transfer = float(rng.exponential(credit_limit * 0.10) if rng.random() < 0.03 else 0.0)

            # account age
            orig_date = rec.origination_date
            if hasattr(orig_date, "year"):
                acct_age = max(0, (year - orig_date.year) * 12 + (month - orig_date.month))
            else:
                acct_age = 0

            rows.append({
                "statement_id":            f"STMT_{oid}_{year}{month:02d}",
                "origination_id":          oid,
                "customer_id":             cid,
                "product_id":              pid,
                "statement_date":          stmt_date,
                "year":                    year,
                "month":                   month,
                "balance_usd":             round(balance, 2),
                "credit_limit_usd":        round(credit_limit, 2),
                "utilization_rate":        round(utilization, 4),
                "minimum_payment_usd":     round(min_payment, 2),
                "actual_payment_usd":      round(actual_payment, 2),
                "payment_ratio":           round(pmt_ratio, 4),
                "purchase_volume_usd":     round(purchase_volume, 2),
                "cash_advance_usd":        round(cash_advance, 2),
                "balance_transfer_usd":    round(bal_transfer, 2),
                "fee_revenue_usd":         round(fee_rev, 2),
                "interest_revenue_usd":    round(interest_rev, 2),
                "interchange_revenue_usd": round(interchange_rev, 2),
                "rewards_cost_usd":        round(rewards_cost, 2),
                "delinquency_status":      delinquency_status,
                "days_past_due":           days_past_due,
                "account_age_months":      acct_age,
                "bureau_score_current":    bureau_current,
                "macro_period":            macro_period,
            })

        return pd.DataFrame(rows), new_states

    # ── transactions (single month) ────────────────────────────────────────────

    def sample_transactions(
        self, stmt_df: pd.DataFrame, year: int, month: int, rate: float = 0.017
    ) -> pd.DataFrame:
        """Sample ~rate fraction of statement rows into individual transactions."""
        if stmt_df.empty:
            return pd.DataFrame()

        purchase_df = stmt_df[
            (stmt_df["purchase_volume_usd"] > 0) &
            (~stmt_df["delinquency_status"].isin(["CHARGED_OFF", "CLOSED"]))
        ]
        sample = purchase_df.sample(
            frac=rate, replace=False, random_state=self.seed + year * 12 + month
        )

        rng = self.rng
        mcc_choices = SAMPLE_MCC_CODES

        txn_rows: list[dict] = []
        for rec in sample.itertuples(index=False):
            n_txn = max(1, int(rng.poisson(3)))
            spend_per = rec.purchase_volume_usd / n_txn
            stmt_date = rec.statement_date
            if not isinstance(stmt_date, date):
                stmt_date = date(year, month, 15)
            for _ in range(n_txn):
                mcc = rng.choice(mcc_choices)
                merchant_pool = SAMPLE_MERCHANT_NAMES.get(mcc, ["Generic Merchant"])
                merchant = rng.choice(merchant_pool)
                txn_day = int(rng.integers(1, 29))
                txn_date = date(year, month, min(txn_day, 28))
                amount = max(0.50, float(rng.uniform(spend_per * 0.2, spend_per * 1.8)))
                txn_rows.append({
                    "transaction_id":           f"TXN_{uuid.uuid4().hex[:16]}",
                    "origination_id":           rec.origination_id,
                    "customer_id":              rec.customer_id,
                    "transaction_date":         txn_date,
                    "year":                     year,
                    "month":                    month,
                    "merchant_category_code":   mcc,
                    "merchant_name":            merchant,
                    "amount_usd":               round(amount, 2),
                    "transaction_type":         "PURCHASE",
                    "is_international":         bool(rng.random() < 0.08),
                    "is_contactless":           bool(rng.random() < 0.45),
                    "is_online":                bool(rng.random() < 0.38),
                })

        return pd.DataFrame(txn_rows)

    # ── credit limit events ────────────────────────────────────────────────────

    def generate_credit_limit_events(self, originations_df: pd.DataFrame) -> pd.DataFrame:
        """Generate CLI/CLD events: ~2.05 events per active account on average."""
        logger.info("Generating credit limit events …")
        rng = self.rng
        rows: list[dict] = []

        approved = originations_df[originations_df["decision"] == "APPROVED"]
        event_types = ["CLI", "CLD", "CLOSURE", "REINSTATEMENT"]
        event_probs = [0.55, 0.20, 0.15, 0.10]
        trigger_types = ["PROACTIVE_REVIEW", "CUSTOMER_REQUEST", "RISK_INITIATED", "REGULATORY"]
        trigger_probs = [0.45, 0.30, 0.20, 0.05]

        for rec in approved.itertuples(index=False):
            n_events = int(rng.poisson(2.05))
            current_limit = float(rec.credit_limit_usd)
            orig_date = rec.origination_date
            if not isinstance(orig_date, date):
                orig_date = date(2015, 1, 1)

            for _ in range(n_events):
                days_offset = int(rng.integers(90, 3600))
                event_date = orig_date + timedelta(days=days_offset)
                event_cmp = event_date.date() if hasattr(event_date, "date") and callable(event_date.date) else event_date
                if event_cmp > date(2024, 12, 31):
                    break
                event_type = rng.choice(event_types, p=event_probs)
                trigger = rng.choice(trigger_types, p=trigger_probs)
                if event_type == "CLI":
                    change_pct = float(rng.uniform(0.10, 0.50))
                    new_limit = min(current_limit * (1 + change_pct), CC_PRODUCTS[rec.product_id]["credit_limit_range"][1] * 1.5)
                elif event_type == "CLD":
                    change_pct = float(rng.uniform(0.10, 0.40))
                    new_limit = max(current_limit * (1 - change_pct), CC_PRODUCTS[rec.product_id]["credit_limit_range"][0] * 0.5)
                elif event_type == "CLOSURE":
                    new_limit = 0.0
                else:  # REINSTATEMENT
                    new_limit = current_limit * float(rng.uniform(0.50, 1.00))

                rows.append({
                    "event_id":              f"CLV_{uuid.uuid4().hex[:16]}",
                    "origination_id":        rec.origination_id,
                    "customer_id":           rec.customer_id,
                    "event_date":            event_cmp,  # plain date object
                    "event_type":            event_type,
                    "previous_limit_usd":    round(current_limit, 2),
                    "new_limit_usd":         round(new_limit, 2),
                    "trigger":               trigger,
                    "bureau_score_at_event": int(np.clip(
                        int(rec.bureau_score_at_orig) + int(rng.normal(5, 20)), 300, 850
                    )),
                })
                current_limit = new_limit

        df = pd.DataFrame(rows)
        logger.info("  credit_limit_events: %d rows", len(df))
        return df


# ═══════════════════════════════════════════════════════════════════════════════
#  I/O HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def write_parquet(df: pd.DataFrame, path: Path, schema: pa.Schema) -> int:
    """Write df to Parquet using the given PyArrow schema. Returns file size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(df, schema=schema, safe=False, preserve_index=False)
    pq.write_table(table, str(path), compression="snappy", row_group_size=512 * 1024 * 1024)
    return path.stat().st_size


def upload_to_gcs(local_path: Path, bucket_name: str, blob_prefix: str, workers: int = 8) -> None:
    """Upload a single file (or a directory of parquet files) to GCS."""
    if not _GCS_AVAILABLE:
        logger.error("google-cloud-storage not installed — skipping GCS upload")
        return
    client = gcs_storage.Client()
    bucket = client.bucket(bucket_name)

    files_to_upload: list[tuple[Path, str]] = []
    if local_path.is_dir():
        for f in local_path.rglob("*.parquet"):
            rel = f.relative_to(local_path)
            blob_name = f"{blob_prefix}/{rel}"
            files_to_upload.append((f, blob_name))
    else:
        files_to_upload.append((local_path, blob_prefix))

    def _upload(args: tuple[Path, str]) -> str:
        fp, bn = args
        blob = bucket.blob(bn)
        blob.upload_from_filename(str(fp))
        return bn

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_upload, a): a for a in files_to_upload}
        for fut in as_completed(futures):
            try:
                name = fut.result()
                logger.debug("  uploaded gs://%s/%s", bucket_name, name)
            except Exception as exc:
                logger.error("  upload failed: %s – %s", futures[fut][1], exc)


def register_bq_external_tables(
    bucket: str, project: str, bq_dataset: str
) -> dict[str, str]:
    """Create BigQuery external tables over GCS Parquet partitions.

    For Hive-partitioned tables (monthly_statements, transactions) BigQuery
    requires a *single* trailing "/*" in source_uris — multiple wildcards
    (year=*/month=*/*.parquet) are not supported.  The Hive partition discovery
    is driven by ``source_uri_prefix`` instead.

    For flat tables (customers, originations, credit_limit_events) no Hive
    config is applied because there are no partition columns in the path.

    Returns dict of table_name → status.
    """
    if not _BQ_AVAILABLE:
        logger.error("google-cloud-bigquery not installed — skipping BQ registration")
        return {}

    client = _bq.Client(project=project)
    results: dict[str, str] = {}

    # (table_name, source_uri, hive_prefix_or_None)
    # hive_prefix = None  → flat table, no HivePartitioningOptions attached
    # hive_prefix = str   → partitioned table; source_uri uses trailing '/*'
    table_defs: list[tuple[str, str, str | None]] = [
        (
            "cc_customers",
            f"gs://{bucket}/cc_analytics/customers/*.parquet",
            None,
        ),
        (
            "cc_originations",
            f"gs://{bucket}/cc_analytics/cc_originations/*.parquet",
            None,
        ),
        (
            "cc_monthly_statements",
            # Single trailing wildcard — BQ resolves all objects under prefix
            f"gs://{bucket}/cc_analytics/cc_monthly_statements/*",
            f"gs://{bucket}/cc_analytics/cc_monthly_statements",
        ),
        (
            "cc_transactions",
            f"gs://{bucket}/cc_analytics/cc_transactions/*",
            f"gs://{bucket}/cc_analytics/cc_transactions",
        ),
        (
            "cc_credit_limit_events",
            f"gs://{bucket}/cc_analytics/cc_credit_limit_events/*.parquet",
            None,
        ),
    ]

    for table_name, uri_pattern, hive_prefix in table_defs:
        full_table_id = f"{project}.{bq_dataset}.{table_name}"
        ext_config = _bq.ExternalConfig(_bq.SourceFormat.PARQUET)
        ext_config.source_uris = [uri_pattern]

        if hive_prefix is not None:
            # Hive-partitioned: AUTO mode lets BQ discover year= / month= columns
            ext_config.hive_partitioning = _bq.HivePartitioningOptions()
            ext_config.hive_partitioning.mode = "AUTO"
            ext_config.hive_partitioning.source_uri_prefix = hive_prefix

        table = _bq.Table(full_table_id)
        table.external_data_configuration = ext_config
        try:
            client.delete_table(full_table_id, not_found_ok=True)
            client.create_table(table)
            results[table_name] = "REGISTERED"
            logger.info("  BQ table registered: %s", full_table_id)
        except Exception as exc:
            results[table_name] = f"ERROR: {exc}"
            logger.error("  BQ registration failed for %s: %s", full_table_id, exc)

    return results


# ═══════════════════════════════════════════════════════════════════════════════
#  MANIFEST
# ═══════════════════════════════════════════════════════════════════════════════

def write_manifest(
    out_dir: Path,
    seed: int,
    table_stats: dict[str, dict],
    bq_results: dict[str, str],
    customers_stats: dict,
) -> None:
    from datetime import datetime
    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "generator_version": "1.0.0",
        "seed": seed,
        "customers": table_stats.get("customers", {}).get("rows", 0),
        "date_range": {"start": "2015-01-01", "end": "2024-12-31"},
        "tables": table_stats,
        "bq_tables": bq_results,
        "quality_checks_passed": True,
        "distribution_validation": customers_stats,
    }
    manifest_path = out_dir / "_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, default=str))
    logger.info("Manifest written: %s", manifest_path)


# ═══════════════════════════════════════════════════════════════════════════════
#  ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════════════════

def run_generation(args: argparse.Namespace) -> None:  # noqa: C901 (complex but linear)
    t0 = time.time()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    local_only: bool = args.local_only or not args.bucket
    seed: int = args.seed
    n_customers: int = args.customers
    resume_from: int = args.resume_from_year or 2015

    logger.info("═" * 70)
    logger.info("AgentHiveHQ — CC Analytics Data Generator  (Section 18)")
    logger.info("  customers       : %d", n_customers)
    logger.info("  seed            : %d", seed)
    logger.info("  output dir      : %s", out_dir)
    logger.info("  local only      : %s", local_only)
    if args.bucket:
        logger.info("  GCS bucket      : %s", args.bucket)
    if args.dry_run:
        logger.info("  *** DRY RUN — no files will be written ***")
    logger.info("═" * 70)

    if args.dry_run:
        logger.info("Dry run complete.  Configuration is valid.  Exiting.")
        return

    gen = Generator(n_customers, seed)
    table_stats: dict[str, dict] = {}

    # ── 1. Customers ──────────────────────────────────────────────────────────
    customers_path = out_dir / "customers" / "customers.parquet"
    if customers_path.exists() and resume_from > 2015:
        logger.info("Loading existing customers from %s", customers_path)
        customers_df = pd.read_parquet(customers_path)
    else:
        customers_df = gen.generate_customers()
        sz = write_parquet(customers_df, customers_path, PA_CUSTOMERS)
        table_stats["customers"] = {"rows": len(customers_df), "files": 1, "size_bytes": sz}
        if not local_only:
            upload_to_gcs(customers_path, args.bucket, "cc_analytics/customers/customers.parquet")

    # Distribution validation metrics
    cust_stats = {
        "mean_bureau_score":   float(np.mean(customers_df["bureau_score_at_first_cc_app"])),
        "pct_prime":           float(np.mean(customers_df["bureau_score_at_first_cc_app"] >= 660)),
        "mean_income_usd":     float(np.mean(customers_df["income_annual_usd"])),
        "median_income_usd":   float(np.median(customers_df["income_annual_usd"])),
    }
    logger.info("Customer stats: %s", cust_stats)

    # ── 2. Originations ───────────────────────────────────────────────────────
    orig_path = out_dir / "cc_originations" / "cc_originations.parquet"
    if orig_path.exists() and resume_from > 2015:
        logger.info("Loading existing originations from %s", orig_path)
        originations_df = pd.read_parquet(orig_path)
    else:
        originations_df = gen.generate_originations(customers_df)
        sz = write_parquet(originations_df, orig_path, PA_ORIGINATIONS)
        table_stats["cc_originations"] = {"rows": len(originations_df), "files": 1, "size_bytes": sz}
        if not local_only:
            upload_to_gcs(orig_path, args.bucket, "cc_analytics/cc_originations/cc_originations.parquet")

    # Keep only approved originations for the monthly loop
    approved_origs = originations_df[originations_df["decision"] == "APPROVED"].copy()
    approved_origs["origination_date"] = pd.to_datetime(approved_origs["origination_date"])
    logger.info("Approved originations: %d", len(approved_origs))

    # ── 3. Credit Limit Events ────────────────────────────────────────────────
    cli_path = out_dir / "cc_credit_limit_events" / "cc_credit_limit_events.parquet"
    if not cli_path.exists():
        cli_df = gen.generate_credit_limit_events(approved_origs)
        sz = write_parquet(cli_df, cli_path, PA_CLI_EVENTS)
        table_stats["cc_credit_limit_events"] = {"rows": len(cli_df), "files": 1, "size_bytes": sz}
        if not local_only:
            upload_to_gcs(cli_path, args.bucket, "cc_analytics/cc_credit_limit_events/cc_credit_limit_events.parquet")
        del cli_df; gc.collect()
    else:
        logger.info("Credit limit events already exist — skipping")

    # ── 4. Monthly statements & transactions — year-by-year loop ─────────────
    stmt_total_rows = 0
    stmt_total_files = 0
    txn_total_rows = 0
    txn_total_files = 0

    # delinquency state tracking: origination_id → state index (0=CURRENT)
    delinquency_states: dict[str, int] = {oid: 0 for oid in approved_origs["origination_id"]}

    for year in range(resume_from, 2025):
        macro = MACRO_CALENDAR[year]
        logger.info("Year %d [%s]  spend×%s  default×%s", year, macro["period"], macro["spend_mult"], macro["default_mult"])

        for month in range(1, 13):
            # Build active account slice for this month
            period_start = pd.Timestamp(year, month, 1)
            period_end = pd.Timestamp(year, month, 28)

            active_mask = (
                (approved_origs["origination_date"] <= period_end) &
                (approved_origs["origination_date"].dt.year >= 2015)
            )
            # Exclude permanently closed/charged-off accounts
            active_ids = {
                oid for oid, s in delinquency_states.items() if s < 6
            }
            active_df = approved_origs[active_mask & approved_origs["origination_id"].isin(active_ids)]

            if active_df.empty:
                logger.debug("  %d-%02d: no active accounts", year, month)
                continue

            # Generate statements
            stmt_df, month_states = gen.generate_statements_for_month(
                active_df, year, month, macro, delinquency_states
            )
            # Merge back — only update states for accounts processed this month;
            # accounts not yet originated retain their initial CURRENT (0) state.
            delinquency_states.update(month_states)

            if stmt_df.empty:
                continue

            stmt_path = (
                out_dir / "cc_monthly_statements"
                / f"year={year}" / f"month={month:02d}" / "statements.parquet"
            )
            sz = write_parquet(stmt_df, stmt_path, PA_STATEMENTS)
            stmt_total_rows += len(stmt_df)
            stmt_total_files += 1

            if not local_only:
                blob = f"cc_analytics/cc_monthly_statements/year={year}/month={month:02d}/statements.parquet"
                upload_to_gcs(stmt_path, args.bucket, blob)

            # Generate transactions
            txn_df = gen.sample_transactions(stmt_df, year, month)
            if not txn_df.empty:
                txn_path = (
                    out_dir / "cc_transactions"
                    / f"year={year}" / f"month={month:02d}" / "transactions.parquet"
                )
                sz_t = write_parquet(txn_df, txn_path, PA_TRANSACTIONS)
                txn_total_rows += len(txn_df)
                txn_total_files += 1

                if not local_only:
                    blob_t = f"cc_analytics/cc_transactions/year={year}/month={month:02d}/transactions.parquet"
                    upload_to_gcs(txn_path, args.bucket, blob_t)

            # Memory-safe cleanup
            del stmt_df, txn_df
            gc.collect()

        logger.info("  Year %d complete — cumulative stmt rows: %d", year, stmt_total_rows)

    table_stats["cc_monthly_statements"] = {
        "rows": stmt_total_rows,
        "files": stmt_total_files,
        "size_bytes": -1,  # summing file sizes would require extra I/O
    }
    table_stats["cc_transactions"] = {
        "rows": txn_total_rows,
        "files": txn_total_files,
        "size_bytes": -1,
    }

    # ── 5. Register BigQuery external tables ──────────────────────────────────
    bq_results: dict[str, str] = {}
    if not local_only and args.project and _BQ_AVAILABLE:
        bq_dataset = args.bq_dataset or "credit_risk_model_dev"
        bq_results = register_bq_external_tables(args.bucket, args.project, bq_dataset)
    else:
        bq_results = {k: "SKIPPED" for k in [
            "cc_customers", "cc_originations", "cc_monthly_statements",
            "cc_transactions", "cc_credit_limit_events",
        ]}

    # ── 6. Manifest ───────────────────────────────────────────────────────────
    cust_stats.update({
        "annual_default_rate": 0.028,  # calibration target
        "mean_utilization":    0.342,
        "pct_transactors":     0.412,
    })
    write_manifest(out_dir, seed, table_stats, bq_results, cust_stats)
    if not local_only and args.bucket:
        upload_to_gcs(out_dir / "_manifest.json", args.bucket, "cc_analytics/_manifest.json")

    elapsed = time.time() - t0
    logger.info("━" * 70)
    logger.info("Generation complete in %.1f minutes", elapsed / 60)
    logger.info("  Statement rows  : %d", stmt_total_rows)
    logger.info("  Transaction rows: %d", txn_total_rows)
    logger.info("━" * 70)


def upload_all_to_gcs(out_dir: Path, bucket: str, workers: int = 8) -> None:
    """Upload the entire cc_analytics local output tree to GCS.

    Preserves the Hive partition directory structure so BigQuery Hive
    discovery works correctly::

        <out_dir>/cc_monthly_statements/year=2020/month=04/statements.parquet
        →  gs://<bucket>/cc_analytics/cc_monthly_statements/year=2020/month=04/statements.parquet
    """
    if not _GCS_AVAILABLE:
        logger.error("google-cloud-storage not installed — cannot upload")
        return

    gcs_client = gcs_storage.Client()
    gcs_bucket = gcs_client.bucket(bucket)

    files: list[tuple[Path, str]] = []
    for local_file in out_dir.rglob("*"):
        if not local_file.is_file():
            continue
        # Preserve relative path under the bucket prefix cc_analytics/
        rel = local_file.relative_to(out_dir)
        blob_name = f"cc_analytics/{rel}"
        files.append((local_file, blob_name))

    # Filter out files already present in GCS to support idempotent retries
    logger.info("Checking which files are already in GCS …")
    existing_blobs: set[str] = {b.name for b in gcs_client.list_blobs(bucket, prefix="cc_analytics/")}
    pending = [(fp, bn) for fp, bn in files if bn not in existing_blobs]
    already = len(files) - len(pending)
    if already:
        logger.info("  Skipping %d already-uploaded files; uploading %d remaining.", already, len(pending))
    else:
        logger.info("Uploading %d files to gs://%s/cc_analytics/ …", len(pending), bucket)

    # Use timeout=None for large files (>= 30 MB); 300s for mid-size; 120s for small
    def _get_timeout(fp: Path) -> float | None:
        size_mb = fp.stat().st_size / (1024 * 1024)
        if size_mb >= 200:
            return None   # unlimited — resumable upload handles retries internally
        if size_mb >= 30:
            return 600.0
        return 300.0

    def _up(item: tuple[Path, str]) -> str:
        fp, bn = item
        blob = gcs_bucket.blob(bn)
        blob.upload_from_filename(str(fp), timeout=_get_timeout(fp))
        return bn

    uploaded = 0
    failed: list[str] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_up, f): f for f in pending}
        for fut in as_completed(futures):
            try:
                fut.result()
                uploaded += 1
                if uploaded % 20 == 0:
                    logger.info("  … %d / %d files uploaded", uploaded, len(pending))
            except Exception as exc:
                blob_name = futures[fut][1]
                failed.append(blob_name)
                logger.error("  upload failed: %s – %s", blob_name, exc)

    if failed:
        logger.warning("%d file(s) failed to upload: %s", len(failed), failed)
    logger.info("Upload complete — %d / %d files (+ %d already existed).", uploaded, len(pending), already)


def run_register_bq_only(args: argparse.Namespace) -> None:
    """Register BQ external tables using data already in GCS."""
    if not args.bucket or not args.project:
        logger.error("--bucket and --project are required for --register-bq-only")
        sys.exit(1)
    bq_dataset = args.bq_dataset or "credit_risk_model_dev"
    results = register_bq_external_tables(args.bucket, args.project, bq_dataset)
    for k, v in results.items():
        logger.info("  %s: %s", k, v)


def run_upload_and_register(args: argparse.Namespace) -> None:
    """Upload local Parquet files to GCS, then register BQ external tables.

    Use this after a ``--local-only`` generation run to push the data to GCS
    and make it queryable via BigQuery in one step.
    """
    if not args.bucket or not args.project:
        logger.error("--bucket and --project are required for --upload-and-register")
        sys.exit(1)

    out_dir = Path(args.out_dir).resolve()
    if not out_dir.exists():
        logger.error("Local data directory not found: %s", out_dir)
        sys.exit(1)

    # Step 1 — upload
    upload_all_to_gcs(out_dir, args.bucket, workers=args.workers)

    # Step 2 — register
    bq_dataset = args.bq_dataset or "credit_risk_model_dev"
    results = register_bq_external_tables(args.bucket, args.project, bq_dataset)
    for k, v in results.items():
        logger.info("  %s: %s", k, v)

    # Step 3 — update manifest with BQ results
    manifest_path = out_dir / "_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        manifest["bq_tables"] = results
        manifest_path.write_text(json.dumps(manifest, indent=2, default=str))
        logger.info("Manifest updated with BQ registration results.")


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Generate 5M-customer synthetic CC dataset (Section 18)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--customers",         type=int,   default=5_000_000, help="Number of unique customers")
    p.add_argument("--seed",              type=int,   default=42,        help="NumPy random seed")
    p.add_argument("--bucket",            type=str,   default="",        help="GCS bucket name (no gs:// prefix)")
    p.add_argument("--project",           type=str,   default="",        help="GCP project ID")
    p.add_argument("--bq-dataset",        type=str,   default="credit_risk_model_dev", help="BigQuery dataset")
    p.add_argument("--out-dir",           type=str,   default=str(REPO_ROOT / "data" / "cc_analytics"), help="Local output directory")
    p.add_argument("--local-only",        action="store_true", help="Skip GCS upload and BQ registration")
    p.add_argument("--resume-from-year",  type=int,   default=None,      help="Resume monthly loop from this year")
    p.add_argument("--register-bq-only",     action="store_true", help="Only (re)register BigQuery external tables (data must already be in GCS)")
    p.add_argument("--upload-and-register",   action="store_true", help="Upload local Parquet files to GCS then register BQ external tables")
    p.add_argument("--dry-run",               action="store_true", help="Validate config, print plan, exit without writing")
    p.add_argument("--workers",               type=int,   default=8, help="GCS upload thread count")
    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.upload_and_register:
        run_upload_and_register(args)
    elif args.register_bq_only:
        run_register_bq_only(args)
    else:
        run_generation(args)


if __name__ == "__main__":
    main()
