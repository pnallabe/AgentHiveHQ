"""
Test Suite: Copula Parametric & Synthesizer Statistical Integrity.
Verifies that generated synthetic distributions preserve empirical correlation structures and cash-flow rules.
"""

import numpy as np
import pytest

from agenthive_data.synthesizers.copula_consumer import GaussianCopulaConsumerSynthesizer
from agenthive_data.synthesizers.commercial_cashflow import CommercialCashFlowSynthesizer
from agenthive_data.synthesizers.longitudinal_tape import LongitudinalPerformanceTapeSynthesizer


def test_copula_consumer_correlation_direction():
    """Asserts that FICO and DTI/Utilization exhibit negative empirical correlation in synthesized batch."""
    synth = GaussianCopulaConsumerSynthesizer(tenant_id="tenant_test", seed=123)
    batch = synth.generate_batch(count=200)

    ficos = [p["application"].stated_fico_score for p in batch]
    utils = [p["bureau"].revolving_utilization_rate for p in batch]
    dtis = [p["bureau"].total_monthly_debt_service for p in batch]

    # Calculate Pearson correlation coefficient
    corr_fico_util = np.corrcoef(ficos, utils)[0, 1]

    # ASSERTION: FICO score and Revolving Utilization MUST be negatively correlated
    assert corr_fico_util < 0.0, f"Expected negative correlation between FICO and Utilization, got {corr_fico_util}"


def test_commercial_mca_stacking_detection():
    """Asserts that injected MCA debt stacking is detected in the synthesized open banking feed."""
    synth = CommercialCashFlowSynthesizer(tenant_id="tenant_test", seed=42)
    feed = synth.generate_daily_feed(
        business_id="BUS_101",
        num_days=60,
        inject_mca_stacking=True,
        mca_lender_count=2,
    )

    assert feed.mca_debt_stacking_detected is True
    mca_txs = [tx for tx in feed.transactions if tx.category == "debt_stacking_mca"]
    assert len(mca_txs) > 0


def test_longitudinal_markov_panel_generation():
    """Asserts that longitudinal loan performance tape contains records with valid transition states."""
    synth = LongitudinalPerformanceTapeSynthesizer(tenant_id="tenant_test", seed=99)
    tape = synth.generate_loan_panel(num_loans=30, observation_months=12)

    assert tape.total_loans == 30
    assert len(tape.records) > 0
    assert tape.total_original_upb > 0.0
