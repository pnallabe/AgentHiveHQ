"""Unit tests for app/shared/rules_engine.py — Story 1.4."""
from __future__ import annotations

import pytest

from app.shared.feature_engineering import transform
from app.shared.rules_engine import evaluate


def _features(income=80_000, employment_length=5.0, housing_status="own", credit_score=720):
    """Helper: build a standard feature dict."""
    return transform({
        "income": income,
        "employment_length": employment_length,
        "housing_status": housing_status,
        "credit_score": credit_score,
    })


class TestMinimumIncomeRule:
    """minimum_income: income < $18,000 → reject / AA-01."""

    def test_income_below_minimum_triggers(self):
        features = _features(income=15_000)
        result = evaluate(features)
        assert result is not None
        assert result.decision == "reject"
        assert result.fcra_code == "AA-01"
        assert result.rule_name == "minimum_income"

    def test_income_at_boundary_does_not_trigger(self):
        features = _features(income=18_000)
        result = evaluate(features)
        # 18_000 is not strictly less than 18_000 — rule should NOT fire
        # (other rules may still fire; we check minimum_income specifically)
        if result is not None:
            assert result.rule_name != "minimum_income"

    def test_high_income_no_trigger(self):
        features = _features(income=80_000, credit_score=720)
        result = evaluate(features)
        assert result is None


class TestNegativeEmploymentRule:
    """negative_employment: employment_length < 0 → reject / AA-09."""

    def test_negative_employment_triggers(self):
        # Bypass validation in feature_engineering by injecting directly.
        import math
        features = {
            "income_log": math.log1p(80_000),
            "income_raw": 80_000.0,   # Required for minimum_income rule check
            "employment_length": -1.0,
            "housing_encoded": 2.0,
            "credit_score_imputed": 720.0,
            "thin_file_flag": 0.0,
            "income_band": 3.0,
        }
        result = evaluate(features)
        assert result is not None
        assert result.fcra_code == "AA-09"

    def test_zero_employment_does_not_trigger(self):
        features = _features(income=80_000, employment_length=0.0, credit_score=720)
        result = evaluate(features)
        assert result is None


class TestVeryLowCreditScoreRule:
    """very_low_credit_score: score present AND < 500 → reject / AA-02."""

    def test_low_score_triggers(self):
        features = _features(income=80_000, credit_score=490)
        result = evaluate(features)
        assert result is not None
        assert result.fcra_code == "AA-02"
        assert result.decision == "reject"

    def test_score_at_499_triggers(self):
        features = _features(income=80_000, credit_score=499)
        result = evaluate(features)
        assert result is not None
        assert result.fcra_code == "AA-02"

    def test_score_at_500_does_not_trigger(self):
        features = _features(income=80_000, credit_score=500)
        result = evaluate(features)
        assert result is None

    def test_thin_file_with_low_imputed_score_does_not_trigger(self):
        """The rule must NOT fire for thin-file applicants (score was absent)."""
        features = _features(income=80_000, credit_score=None)
        result = evaluate(features)
        # Thin-file rule may fire (different condition), but NOT low-credit-score rule.
        if result is not None:
            assert result.rule_name != "very_low_credit_score"


class TestThinFileLowIncomeRule:
    """thin_file_low_income: no score AND income < $40k → review / AA-07."""

    def test_thin_file_low_income_triggers(self):
        features = _features(income=35_000, credit_score=None)
        result = evaluate(features)
        assert result is not None
        assert result.fcra_code == "AA-07"
        assert result.decision == "review"

    def test_thin_file_high_income_does_not_trigger(self):
        features = _features(income=50_000, credit_score=None)
        result = evaluate(features)
        assert result is None

    def test_score_present_low_income_does_not_trigger_this_rule(self):
        features = _features(income=35_000, credit_score=650)
        result = evaluate(features)
        if result is not None:
            assert result.rule_name != "thin_file_low_income"


class TestPriorityOrder:
    """Rules must fire in declared priority order — first match wins."""

    def test_minimum_income_beats_thin_file(self):
        """income < $18k AND thin-file → minimum_income fires first."""
        features = _features(income=10_000, credit_score=None)
        result = evaluate(features)
        assert result is not None
        assert result.rule_name == "minimum_income"

    def test_clean_profile_returns_none(self):
        """Income = $80k, score = 720, own → no rule fires."""
        features = _features(income=80_000, credit_score=720)
        assert evaluate(features) is None
