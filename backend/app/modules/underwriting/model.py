"""Production underwriting model — scikit-learn LogisticRegression Pipeline.

Sprint 3 replaces the mock model (Sprint 1) with a trained artifact.

Model lifecycle:
  1. Generate synthetic data:
        python -m app.modules.underwriting.data_generator --output data/synthetic_train.csv
  2. Train and save:
        python -m app.modules.underwriting.model --train --output models/underwriting_v1.pkl
  3. The saved artifact is loaded once at application startup.

Public API:
    model = UnderwritingModel.load("models/underwriting_v1.pkl")
    result = model.predict(features)            # → ModelOutput
    terms  = model.compute_credit_terms(p, i)  # → dict
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.shared.feature_engineering import FEATURES, transform

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
MODEL_VERSION = "1.0.0"
_THRESHOLD = 0.50
_BACKGROUND_ROWS = 200      # rows stored alongside artifact for SHAP


@dataclass(frozen=True)
class ModelOutput:
    """Structured output from a single model.predict() call."""
    probability: float            # P(approve) in [0, 1]
    decision: str                 # "approve" | "reject"
    confidence_score: float       # abs(probability - 0.5) * 2  → [0, 1]
    credit_limit: Optional[float] # Rounded to nearest $500; None on reject
    apr: float                    # Annual percentage rate
    risk_segment: str             # prime | near-prime | high-risk | thin-file


# ── Model class ───────────────────────────────────────────────────────────────

class UnderwritingModel:
    """Trained scikit-learn underwriting model.

    Wraps a StandardScaler + LogisticRegression Pipeline together with
    training metadata (version, artifact hash) and SHAP background data.
    """

    MODEL_VERSION: str = MODEL_VERSION

    def __init__(
        self,
        pipeline: Pipeline,
        background_data: np.ndarray,
        artifact_hash: str,
    ) -> None:
        self._pipeline = pipeline
        self._background_data = background_data   # shape (N, len(FEATURES))
        self._artifact_hash = artifact_hash
        clf: LogisticRegression = self._pipeline.named_steps["clf"]
        scaler: StandardScaler = self._pipeline.named_steps["scaler"]
        self._coef = clf.coef_[0] / scaler.scale_
        self._intercept = float(clf.intercept_[0])

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(self, features: dict[str, Any]) -> ModelOutput:
        """Score a feature dict and return a structured decision."""
        X = self._feature_array(features)
        probability = float(self._pipeline.predict_proba(X)[0, 1])
        decision = "approve" if probability >= _THRESHOLD else "reject"
        confidence_score = round(abs(probability - 0.5) * 2, 4)

        income = math.expm1(features["income_log"])
        credit_limit_val, apr = self.compute_credit_terms(probability, income)
        risk_segment = self._risk_segment(probability, features)

        return ModelOutput(
            probability=round(probability, 4),
            decision=decision,
            confidence_score=confidence_score,
            credit_limit=credit_limit_val if decision == "approve" else None,
            apr=apr,
            risk_segment=risk_segment,
        )

    # ── Credit terms ──────────────────────────────────────────────────────────

    @staticmethod
    def compute_credit_terms(probability: float, income: float) -> tuple[float, float]:
        """Compute risk-based credit limit and APR."""
        base_limit = min(income * 0.15, 25_000.0)
        adjusted = base_limit * (0.5 + probability * 0.5)
        credit_limit = round(adjusted / 500) * 500

        if probability < 0.30:
            apr = 29.99
        elif probability < 0.50:
            apr = 24.99
        elif probability < 0.70:
            apr = 19.99
        else:
            apr = 14.99

        return float(credit_limit), apr

    # ── SHAP-like attribution ─────────────────────────────────────────────────

    def compute_shap(self, features: dict[str, Any]) -> dict[str, float]:
        """Compute linear SHAP values: coef_i × (x_i − E[x_i])."""
        X = self._feature_array(features)[0]
        bg_mean = self._background_data.mean(axis=0)
        raw_shap = self._coef * (X - bg_mean)
        return {
            feature: round(float(raw_shap[i]), 4)
            for i, feature in enumerate(FEATURES)
        }

    @property
    def artifact_hash(self) -> str:
        return self._artifact_hash

    # ── Serialization ─────────────────────────────────────────────────────────

    def save(self, path: str | Path) -> str:
        """Serialize pipeline + background data and write SHA256 hash file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "pipeline":        self._pipeline,
            "background_data": self._background_data,
            "model_version":   MODEL_VERSION,
        }
        joblib.dump(payload, path, compress=3)

        digest = _sha256(path)
        path.with_suffix(path.suffix + ".sha256").write_text(digest)
        logger.info("Model artifact saved", extra={"path": str(path), "sha256": digest[:12]})
        return digest

    @classmethod
    def load(cls, path: str | Path) -> "UnderwritingModel":
        """Load and integrity-verify a previously saved artifact."""
        path = Path(path)
        hash_path = path.with_suffix(path.suffix + ".sha256")

        if not path.exists():
            raise FileNotFoundError(f"Model artifact not found: {path}")
        if not hash_path.exists():
            raise FileNotFoundError(f"Model hash file not found: {hash_path}")

        stored_hash = hash_path.read_text().strip()
        actual_hash = _sha256(path)
        if actual_hash != stored_hash:
            raise ValueError(
                f"Model artifact integrity check failed: "
                f"expected {stored_hash[:12]}… got {actual_hash[:12]}…"
            )

        payload = joblib.load(path)
        logger.info("Model artifact loaded", extra={"path": str(path), "sha256": actual_hash[:12]})
        return cls(
            pipeline=payload["pipeline"],
            background_data=payload["background_data"],
            artifact_hash=actual_hash,
        )

    # ── Training ──────────────────────────────────────────────────────────────

    @classmethod
    def train(cls, df: Any) -> "UnderwritingModel":
        """Train pipeline on a prepared DataFrame."""
        feature_rows = []
        targets = []
        for _, row in df.iterrows():
            raw = row.drop("approved").to_dict()
            # Pandas reads None/NaN as float NaN — convert back to None for transform().
            if "credit_score" in raw:
                val = raw["credit_score"]
                if val != val:  # NaN check (NaN != NaN)
                    raw["credit_score"] = None
                elif val is not None:
                    raw["credit_score"] = int(val)
            feats = transform(raw)
            feature_rows.append([feats[f] for f in FEATURES])
            targets.append(int(row["approved"]))

        X = np.array(feature_rows, dtype=float)
        y = np.array(targets, dtype=int)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42, stratify=y
        )

        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(C=1.0, max_iter=1_000, random_state=42)),
        ])
        pipeline.fit(X_train, y_train)

        y_prob_test = pipeline.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_prob_test)
        gini = 2 * auc - 1

        pos_scores = np.sort(y_prob_test[y_test == 1])
        neg_scores = np.sort(y_prob_test[y_test == 0])
        ks = float(np.max(np.abs(
            np.searchsorted(pos_scores, y_prob_test, side="right") / len(pos_scores)
            - np.searchsorted(neg_scores, y_prob_test, side="right") / len(neg_scores)
        )))
        approval_rate = float((pipeline.predict(X_test) == 1).mean())

        logger.info(
            "Model training complete",
            extra={"auc_roc": round(auc, 4), "gini": round(gini, 4),
                   "ks": round(ks, 4), "approval_rate_test": round(approval_rate, 4)},
        )
        print(f"  AUC-ROC : {auc:.4f}")
        print(f"  Gini    : {gini:.4f}")
        print(f"  KS stat : {ks:.4f}")
        print(f"  Approval rate (test): {approval_rate:.1%}")
        if auc < 0.75:
            logger.warning(f"AUC-ROC {auc:.4f} below 0.75 threshold")

        background_data = X_train[:_BACKGROUND_ROWS]
        instance = cls.__new__(cls)
        instance._pipeline = pipeline
        instance._background_data = background_data
        instance._artifact_hash = ""
        clf: LogisticRegression = pipeline.named_steps["clf"]
        scaler: StandardScaler = pipeline.named_steps["scaler"]
        instance._coef = clf.coef_[0] / scaler.scale_
        instance._intercept = float(clf.intercept_[0])
        return instance

    # ── Private helpers ───────────────────────────────────────────────────────

    def _feature_array(self, features: dict[str, Any]) -> np.ndarray:
        row = [float(features.get(f, 0.0)) for f in FEATURES]
        return np.array([row], dtype=float)

    @staticmethod
    def _risk_segment(probability: float, features: dict[str, Any]) -> str:
        if features.get("thin_file_flag", 0):
            return "thin-file"
        if probability >= 0.70:
            return "prime"
        if probability >= 0.50:
            return "near-prime"
        return "high-risk"


# ── MockUnderwritingModel (backward compatibility / unit tests) ───────────────

class MockUnderwritingModel:
    """Deterministic mock — used when no trained artifact is present."""

    MODEL_VERSION: str = "mock-1.0.0"

    _WEIGHTS: dict[str, float] = {
        "credit_score_imputed": 0.008,
        "income_log":           0.45,
        "employment_length":    0.03,
        "housing_encoded":      0.12,
        "thin_file_flag":      -0.40,
        "income_band":          0.10,
    }
    _BIAS: float = -5.0
    _THRESHOLD: float = 0.50

    @property
    def artifact_hash(self) -> str:
        return "mock"

    def predict(self, features: dict[str, Any]) -> ModelOutput:
        probability = self._logistic(features)
        decision = "approve" if probability >= self._THRESHOLD else "reject"
        confidence_score = round(abs(probability - 0.5) * 2, 4)
        income = math.expm1(features["income_log"])
        credit_limit_val, apr = UnderwritingModel.compute_credit_terms(probability, income)
        risk_segment = UnderwritingModel._risk_segment(probability, features)
        return ModelOutput(
            probability=round(probability, 4),
            decision=decision,
            confidence_score=confidence_score,
            credit_limit=credit_limit_val if decision == "approve" else None,
            apr=apr,
            risk_segment=risk_segment,
        )

    def compute_shap(self, features: dict[str, Any]) -> dict[str, float]:
        return {
            f: round(self._WEIGHTS.get(f, 0.0) * float(features.get(f, 0.0)) / 10.0, 4)
            for f in FEATURES
        }

    def _logistic(self, features: dict[str, Any]) -> float:
        log_odds = self._BIAS + sum(
            self._WEIGHTS.get(f, 0.0) * float(features.get(f, 0.0))
            for f in FEATURES
        )
        return 1.0 / (1.0 + math.exp(-log_odds))


# ── Utilities ─────────────────────────────────────────────────────────────────

def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65_536), b""):
            h.update(chunk)
    return h.hexdigest()


# ── Module-level factory ──────────────────────────────────────────────────────

def load_or_mock(artifact_path: str = "models/underwriting_v1.pkl") -> "UnderwritingModel | MockUnderwritingModel":
    """Load trained artifact; fall back to MockUnderwritingModel.

    Called ONCE at application startup.
    """
    path = Path(artifact_path)
    if not path.is_absolute():
        base = Path(__file__).parent.parent.parent.parent  # backend/
        path = base / artifact_path

    if path.exists():
        try:
            model = UnderwritingModel.load(path)
            logger.info("Loaded trained model", extra={"sha256": model.artifact_hash[:12]})
            return model
        except Exception as exc:
            logger.error(f"Model load failed: {exc} — falling back to mock")

    logger.warning("No model artifact found — using MockUnderwritingModel")
    return MockUnderwritingModel()


# ── CLI entry point ───────────────────────────────────────────────────────────

def _main() -> None:
    import logging as _logging
    _logging.basicConfig(level=_logging.INFO, format="%(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Train the underwriting model")
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--data", default="data/synthetic_train.csv")
    parser.add_argument("--output", default="models/underwriting_v1.pkl")
    args = parser.parse_args()

    if not args.train:
        parser.print_help()
        return

    import pandas as pd
    from app.modules.underwriting.data_generator import generate

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Generating synthetic training data…")
        data_path.parent.mkdir(parents=True, exist_ok=True)
        df = generate()
        df.to_csv(data_path, index=False)
    else:
        df = pd.read_csv(data_path)

    print(f"Training on {len(df):,} samples…")
    model = UnderwritingModel.train(df)
    digest = model.save(Path(args.output))
    print(f"Saved to {args.output} (sha256:{digest[:12]})")


if __name__ == "__main__":
    _main()
