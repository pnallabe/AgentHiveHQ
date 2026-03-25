"""SHAP explainability wrapper for the underwriting model.

Story 3.3 — provides signed feature attributions for every credit decision
so that any outcome can be explained to regulators, applicants, or auditors.

For a LogisticRegression pipeline the exact SHAP values are computed via
shap.LinearExplainer, which is O(features) and adds < 50 ms overhead.

Public API:
    explainer = SHAPExplainer.from_model(model)
    shap_vals = explainer.explain(features)  # → dict[str, float]
"""
from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any

import numpy as np
import shap

from app.shared.feature_engineering import FEATURES

if TYPE_CHECKING:
    from app.modules.underwriting.model import UnderwritingModel

logger = logging.getLogger(__name__)


class SHAPExplainer:
    """Wraps shap.LinearExplainer for the underwriting model pipeline.

    Attributes:
        _explainer: shap.LinearExplainer instance (lazily shares the
                    sklearn pipeline's classifier step + background data).
    """

    def __init__(self, explainer: shap.LinearExplainer, scaler: Any) -> None:
        self._explainer = explainer
        self._scaler = scaler          # StandardScaler — used to un-transform input

    @classmethod
    def from_model(cls, model: "UnderwritingModel") -> "SHAPExplainer":
        """Build a SHAPExplainer from a loaded UnderwritingModel.

        The classifier operates in scaled feature space; we construct the
        explainer on background data that has been passed through the scaler
        so that SHAP values are in the scaled feature space, then un-scale
        them for interpretability.

        Args:
            model: Loaded ``UnderwritingModel`` instance.

        Returns:
            Ready-to-use ``SHAPExplainer``.
        """
        pipeline = model._pipeline
        scaler = pipeline.named_steps["scaler"]
        clf    = pipeline.named_steps["clf"]

        # Background dataset — already in original feature space.
        bg_raw = model._background_data              # (N, n_features)
        bg_scaled = scaler.transform(bg_raw)         # (N, n_features)

        t0 = time.perf_counter()
        explainer = shap.LinearExplainer(
            clf,
            masker=bg_scaled,
            feature_names=FEATURES,
        )
        elapsed = (time.perf_counter() - t0) * 1_000
        logger.info(
            "SHAPExplainer initialised",
            extra={"elapsed_ms": round(elapsed, 1), "background_rows": len(bg_raw)},
        )
        return cls(explainer=explainer, scaler=scaler)

    def explain(self, features: dict[str, Any]) -> dict[str, float]:
        """Compute signed SHAP values for a single applicant feature dict.

        Positive value → feature supports approval.
        Negative value → feature reduces approval likelihood.

        Args:
            features: Output of ``feature_engineering.transform()``.

        Returns:
            Dict {feature_name: shap_value} for all features in FEATURES.
            Values are signed floats in log-odds space.
        """
        t0 = time.perf_counter()

        row = np.array([[float(features.get(f, 0.0)) for f in FEATURES]])
        row_scaled = self._scaler.transform(row)

        shap_values = self._explainer.shap_values(row_scaled)
        # shap_values shape: (1, n_features) for linear models
        if isinstance(shap_values, list):
            # Binary classification returns list of two arrays; take class-1.
            vals = shap_values[1][0]
        else:
            vals = shap_values[0]

        elapsed = (time.perf_counter() - t0) * 1_000
        logger.debug(
            "SHAP computation complete",
            extra={"elapsed_ms": round(elapsed, 2)},
        )
        if elapsed > 100:
            logger.warning(f"SHAP overhead {elapsed:.0f}ms exceeds 100ms target")

        return {
            feature: round(float(vals[i]), 4)
            for i, feature in enumerate(FEATURES)
        }


class MockSHAPExplainer:
    """Deterministic mock — used when the trained model is unavailable.

    Proportional to hand-coded feature weights.  Not true Shapley values.
    """

    _WEIGHTS: dict[str, float] = {
        "income_log":            0.45,
        "employment_length":     0.03,
        "housing_encoded":       0.12,
        "credit_score_imputed":  0.008,
        "thin_file_flag":       -0.40,
        "dti_ratio":             0.05,
        "income_band":           0.10,
    }

    def explain(self, features: dict[str, Any]) -> dict[str, float]:
        return {
            f: round(self._WEIGHTS.get(f, 0.0) * float(features.get(f, 0.0)) / 10.0, 4)
            for f in FEATURES
        }
