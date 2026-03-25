"""Deterministic feature engineering for the AgentHive underwriting model.

All transforms are pure functions (no side effects).  Imputation constants
live in CONFIG so they are identical at training-time and inference-time —
a critical requirement for model reproducibility and SHAP correctness.
"""
from __future__ import annotations

import math
from typing import Any

# ── Imputation constants ──────────────────────────────────────────────────────
# IMPORTANT: These values MUST match the mean credit score used when training
# the ML model.  If the model is retrained with a different imputation value,
# bump MODEL_VERSION in underwriting/model.py.
CONFIG: dict[str, Any] = {
    "credit_score_imputation": 620,  # Median prime/near-prime credit score
    "housing_encoding": {
        "own": 2,
        "mortgage": 1,
        "rent": 0,
    },
    "income_bands": [
        (25_000, 0),   # < 25k  → band 0
        (50_000, 1),   # 25–50k → band 1
        (100_000, 2),  # 50–100k → band 2
        (float("inf"), 3),  # 100k+ → band 3
    ],
}

# ── Feature list (must match model training column order) ────────────────────
FEATURES: list[str] = [
    "income_log",           # log1p(income)          — handles right-skew
    "employment_length",    # years of continuous employment
    "housing_encoded",      # ordinal: own>mortgage>rent
    "credit_score_imputed", # raw score, or CONFIG default for thin-file
    "thin_file_flag",       # 1 when credit_score was absent
    "income_band",          # coarse income bucket 0–3
]

# NOTE: transform() also returns "income_raw" for use by the rules engine.
# Do NOT include it in FEATURES — it should not be passed to the ML model.


def transform(raw: dict[str, Any]) -> dict[str, float]:
    """Map a raw underwriting request dict into model-ready features.

    Args:
        raw: Dict with keys: income, employment_length, housing_status,
             credit_score (may be None for thin-file applicants).

    Returns:
        Dict mapping each FEATURES key to a numeric value.

    Raises:
        KeyError:   If a required key is missing from *raw*.
        ValueError: If a value is out of accepted range.
    """
    income: float = float(raw["income"])
    employment_length: float = float(raw["employment_length"])
    housing_status: str = str(raw["housing_status"]).lower()
    credit_score: int | None = raw.get("credit_score")  # None = thin-file

    if income <= 0:
        raise ValueError(f"income must be positive, got {income}")

    if employment_length < 0:
        raise ValueError(f"employment_length cannot be negative, got {employment_length}")

    if housing_status not in CONFIG["housing_encoding"]:
        raise ValueError(
            f"housing_status must be one of {list(CONFIG['housing_encoding'].keys())}, "
            f"got '{housing_status}'"
        )

    # ── Transforms ────────────────────────────────────────────────────────────

    income_log = math.log1p(income)

    housing_encoded = float(CONFIG["housing_encoding"][housing_status])

    thin_file_flag = 1.0 if credit_score is None else 0.0

    credit_score_imputed = float(
        credit_score if credit_score is not None else CONFIG["credit_score_imputation"]
    )

    income_band = _compute_income_band(income)

    return {
        "income_log": income_log,
        "income_raw": income,          # Used by rules engine — NOT by ML model
        "employment_length": employment_length,
        "housing_encoded": housing_encoded,
        "credit_score_imputed": credit_score_imputed,
        "thin_file_flag": thin_file_flag,
        "income_band": float(income_band),
    }


def _compute_income_band(income: float) -> int:
    """Return the income band index for *income*."""
    for threshold, band in CONFIG["income_bands"]:
        if income < threshold:
            return band
    return 3  # > 100k (fallback, should be covered by float("inf") entry)
