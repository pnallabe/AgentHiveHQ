"""Unit tests for app/shared/feature_engineering.py — Story 1.3."""
from __future__ import annotations

import math

import pytest

from app.shared.feature_engineering import CONFIG, FEATURES, transform


class TestTransformPureFunction:
    """transform() must be deterministic and have no side effects."""

    def test_same_input_same_output(self):
        raw = {"income": 60_000, "employment_length": 5.0, "housing_status": "mortgage", "credit_score": 720}
        assert transform(raw) == transform(raw)

    def test_returns_all_features(self):
        raw = {"income": 50_000, "employment_length": 2.0, "housing_status": "rent", "credit_score": 650}
        result = transform(raw)
        for feature in FEATURES:
            assert feature in result, f"Missing feature: {feature}"


class TestIncomeLog:
    """income_log = log1p(income)."""

    def test_income_log_formula(self):
        raw = {"income": 75_000, "employment_length": 3.0, "housing_status": "own", "credit_score": 700}
        result = transform(raw)
        assert result["income_log"] == pytest.approx(math.log1p(75_000))

    def test_high_income(self):
        raw = {"income": 999_999, "employment_length": 10.0, "housing_status": "own", "credit_score": 800}
        result = transform(raw)
        assert result["income_log"] == pytest.approx(math.log1p(999_999))


class TestHousingEncoding:
    """housing_encoded: own=2, mortgage=1, rent=0."""

    @pytest.mark.parametrize("status,expected", [
        ("own",      2.0),
        ("mortgage", 1.0),
        ("rent",     0.0),
    ])
    def test_encoding(self, status: str, expected: float):
        raw = {"income": 50_000, "employment_length": 2.0, "housing_status": status, "credit_score": 650}
        assert transform(raw)["housing_encoded"] == expected

    def test_invalid_housing_status_raises(self):
        raw = {"income": 50_000, "employment_length": 2.0, "housing_status": "condo", "credit_score": 650}
        with pytest.raises(ValueError, match="housing_status"):
            transform(raw)


class TestCreditScoreImputation:
    """credit_score_imputed uses CONFIG default when score is None."""

    def test_score_present(self):
        raw = {"income": 60_000, "employment_length": 4.0, "housing_status": "rent", "credit_score": 710}
        result = transform(raw)
        assert result["credit_score_imputed"] == 710.0

    def test_score_none_uses_imputation(self):
        raw = {"income": 60_000, "employment_length": 4.0, "housing_status": "rent", "credit_score": None}
        result = transform(raw)
        assert result["credit_score_imputed"] == float(CONFIG["credit_score_imputation"])

    def test_thin_file_flag_set_when_score_none(self):
        raw = {"income": 60_000, "employment_length": 4.0, "housing_status": "rent", "credit_score": None}
        assert transform(raw)["thin_file_flag"] == 1.0

    def test_thin_file_flag_clear_when_score_present(self):
        raw = {"income": 60_000, "employment_length": 4.0, "housing_status": "rent", "credit_score": 700}
        assert transform(raw)["thin_file_flag"] == 0.0


class TestIncomeBand:
    """income_band: 0=<25k, 1=25–50k, 2=50–100k, 3=100k+."""

    @pytest.mark.parametrize("income,expected_band", [
        (10_000,  0),
        (24_999,  0),
        (25_000,  1),
        (49_999,  1),
        (50_000,  2),
        (99_999,  2),
        (100_000, 3),
        (250_000, 3),
    ])
    def test_income_band(self, income: int, expected_band: int):
        raw = {"income": income, "employment_length": 2.0, "housing_status": "rent", "credit_score": 650}
        assert transform(raw)["income_band"] == float(expected_band)


class TestEdgeCases:
    """Boundary and error conditions."""

    def test_zero_income_raises(self):
        raw = {"income": 0, "employment_length": 2.0, "housing_status": "rent", "credit_score": 650}
        with pytest.raises(ValueError, match="income must be positive"):
            transform(raw)

    def test_negative_income_raises(self):
        raw = {"income": -1, "employment_length": 2.0, "housing_status": "rent", "credit_score": 650}
        with pytest.raises(ValueError, match="income must be positive"):
            transform(raw)

    def test_negative_employment_raises(self):
        raw = {"income": 50_000, "employment_length": -1.0, "housing_status": "rent", "credit_score": 650}
        with pytest.raises(ValueError, match="employment_length cannot be negative"):
            transform(raw)

    def test_minimum_valid_score(self):
        raw = {"income": 50_000, "employment_length": 2.0, "housing_status": "rent", "credit_score": 300}
        result = transform(raw)
        assert result["credit_score_imputed"] == 300.0
        assert result["thin_file_flag"] == 0.0
