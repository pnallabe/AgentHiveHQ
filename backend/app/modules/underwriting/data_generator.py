"""Synthetic training data generator for the underwriting model.

Run as a module to generate CSV output:
    python -m app.modules.underwriting.data_generator --output data/synthetic_train.csv

Design constraints (Story 3.1):
- 10,000 samples by default
- seed=42 for full reproducibility
- Approval rate ~68% (65–71% range)
- ~30% of rows have credit_score = None (thin-file)
- No negative incomes or impossible credit scores
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Generator parameters ──────────────────────────────────────────────────────
_DEFAULT_N = 10_000
_SEED = 42
_THIN_FILE_RATE = 0.30          # 30 % of applicants have no credit history
_TARGET_APPROVAL_RATE = 0.68    # ~68 % approval — industry benchmark


def generate(n: int = _DEFAULT_N, seed: int = _SEED) -> pd.DataFrame:
    """Generate a synthetic underwriting dataset.

    The returned DataFrame has columns matching the raw API request fields
    plus a binary ``approved`` target column.

    Args:
        n:    Number of rows to generate.
        seed: Random seed — ensures identical output across runs.

    Returns:
        pandas DataFrame with columns:
        income, employment_length, housing_status, credit_score (nullable),
        approved (0/1).
    """
    rng = np.random.default_rng(seed)

    # ── Income: log-normal (mean $65k, std $35k) ──────────────────────────────
    # log-normal parameters: mu / sigma in log-space
    mu_income = np.log(65_000)
    sigma_income = np.log(1 + (35_000 / 65_000) ** 2) ** 0.5
    incomes = rng.lognormal(mean=mu_income, sigma=sigma_income, size=n)
    incomes = np.clip(incomes, 15_000, 500_000).astype(float)

    # ── Employment: gamma (shape=2, scale=3) → 0–40 years ────────────────────
    employment = rng.gamma(shape=2.0, scale=3.0, size=n)
    employment = np.clip(employment, 0.0, 40.0).round(1)

    # ── Housing status: categorical ───────────────────────────────────────────
    housing_choices = rng.choice(
        ["own", "mortgage", "rent"],
        size=n,
        p=[0.20, 0.35, 0.45],
    )

    # ── Credit score: beta-scaled 500–850; 30% thin-file (None) ──────────────
    thin_file_mask = rng.random(size=n) < _THIN_FILE_RATE
    # Beta distribution concentrated toward higher scores (α=5, β=2)
    raw_scores = rng.beta(a=5, b=2, size=n)
    credit_scores = (raw_scores * 350 + 500).round().astype(int)  # 500–850
    credit_scores = np.clip(credit_scores, 500, 850)
    credit_scores_nullable: list[Optional[int]] = [
        None if thin_file_mask[i] else int(credit_scores[i])
        for i in range(n)
    ]

    # ── Build approval labels ─────────────────────────────────────────────────
    # Compute intermediate feature vectors needed for label generation.
    housing_enc     = np.where(housing_choices == "own", 2,
                      np.where(housing_choices == "mortgage", 1, 0)).astype(float)
    thin_file_flag  = thin_file_mask.astype(float)
    score_imputed   = np.where(thin_file_mask, 620.0, credit_scores.astype(float))

    # Scaled features (all in [0,1]) produce better-calibrated log-odds.
    # Weights are sized so the log-odds spread covers roughly [-3, +3]
    # giving strong class separation (target AUC > 0.75).
    score_scaled   = (score_imputed - 300) / 550          # 0→1 (300-850 range)
    income_scaled  = np.clip((incomes - 15_000) / 235_000, 0.0, 1.0)
    employ_scaled  = np.clip(employment / 20, 0.0, 1.0)
    housing_scaled = housing_enc / 2.0                    # 0→1

    # Intercept calibrated to yield ~68% approval before jitter.
    log_odds = (
        -1.5
        + 3.5  * score_scaled        # Credit score is strongest predictor
        + 2.0  * income_scaled        # Income second
        + 1.0  * employ_scaled        # Employment stability
        + 0.5  * housing_scaled       # Housing type
        + (-2.5) * thin_file_flag     # Thin-file penalty
    )

    # Tiny jitter preserves AUC while adding realistic variance.
    jitter = rng.normal(scale=0.15, size=n)
    prob_approve = 1 / (1 + np.exp(-(log_odds + jitter)))

    # ── Calibrate to target approval rate ────────────────────────────────────
    # Find intercept shift that moves mean(prob) to _TARGET_APPROVAL_RATE.
    current_rate = prob_approve.mean()
    shift = np.log(_TARGET_APPROVAL_RATE / (1 - _TARGET_APPROVAL_RATE)) \
          - np.log(current_rate / (1 - current_rate))
    prob_approve = 1 / (1 + np.exp(-(log_odds + jitter + shift)))

    approved = (rng.random(size=n) < prob_approve).astype(int)

    # ── Assemble DataFrame ────────────────────────────────────────────────────
    df = pd.DataFrame({
        "income":            incomes,
        "employment_length": employment,
        "housing_status":    housing_choices,
        "credit_score":      credit_scores_nullable,
        "approved":          approved,
    })

    # ── Sanity checks ─────────────────────────────────────────────────────────
    assert (df["income"] > 0).all(), "Negative income detected"
    assert df["credit_score"].dropna().between(500, 850).all(), "Invalid credit scores"
    actual_rate = df["approved"].mean()
    logger.info(
        "Synthetic dataset generated",
        extra={
            "n": n,
            "seed": seed,
            "approval_rate": round(float(actual_rate), 4),
            "thin_file_pct": round(float(df["credit_score"].isna().mean()), 4),
        },
    )

    return df


# ── CLI entry point ───────────────────────────────────────────────────────────

def _main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic underwriting training data"
    )
    parser.add_argument(
        "--output",
        default="data/synthetic_train.csv",
        help="Output CSV path (default: data/synthetic_train.csv)",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=_DEFAULT_N,
        help=f"Number of samples (default: {_DEFAULT_N})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=_SEED,
        help=f"Random seed (default: {_SEED})",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = generate(n=args.n, seed=args.seed)
    df.to_csv(out_path, index=False)
    print(f"Saved {len(df):,} rows to {out_path}")
    print(f"  Approval rate: {df['approved'].mean():.1%}")
    print(f"  Thin-file pct: {df['credit_score'].isna().mean():.1%}")


if __name__ == "__main__":
    _main()
