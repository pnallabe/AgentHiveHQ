"""Hard rules engine for AgentHive underwriting.

Rules are FCRA §615-compliant mandatory rejection/review gates evaluated
BEFORE the ML model.  The first matching rule in RULES wins — priority
order is intentional and must not be changed without compliance sign-off.

Each rule returns a ``RuleResult`` dataclass, or ``None`` if the rule
does not fire.  ``evaluate()`` iterates rules in priority order and
returns the first non-None result.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional


@dataclass(frozen=True)
class RuleResult:
    """Outcome of a triggered underwriting rule.

    Attributes:
        rule_name:   Internal identifier (snake_case).
        decision:    "reject" | "review"  — rules never approve directly.
        reason_code: Short machine-readable code logged to audit trail.
        fcra_code:   FCRA §615 adverse action code for consumer disclosure.
    """
    rule_name: str
    decision: str  # Literal["reject", "review"]
    reason_code: str
    fcra_code: str


@dataclass(frozen=True)
class _Rule:
    """Internal rule descriptor."""
    name: str
    decision: str
    reason_code: str
    fcra_code: str
    predicate: Callable[[dict[str, Any]], bool]

    def evaluate(self, features: dict) -> Optional[RuleResult]:
        if self.predicate(features):
            return RuleResult(
                rule_name=self.name,
                decision=self.decision,
                reason_code=self.reason_code,
                fcra_code=self.fcra_code,
            )
        return None


# ── Rule definitions (priority order — DO NOT reorder without compliance review) ──
RULES: list[_Rule] = [
    _Rule(
        name="minimum_income",
        decision="reject",
        reason_code="INCOME_BELOW_MINIMUM",
        fcra_code="AA-01",
        # $18,000 annual income floor reflects regulatory minimum wage guidance.
        # Use income_raw to avoid floating-point round-trip errors through log1p/expm1.
        predicate=lambda f: float(f.get("income_raw", 0)) < 18_000,
    ),
    _Rule(
        name="negative_employment",
        decision="reject",
        reason_code="INVALID_EMPLOYMENT_DATA",
        fcra_code="AA-09",
        predicate=lambda f: f["employment_length"] < 0,
    ),
    _Rule(
        name="very_low_credit_score",
        decision="reject",
        reason_code="CREDIT_SCORE_TOO_LOW",
        fcra_code="AA-02",
        # Only fires when credit_score was explicitly provided (thin_file_flag=0).
        predicate=lambda f: f["thin_file_flag"] == 0.0 and f["credit_score_imputed"] < 500,
    ),
    _Rule(
        name="thin_file_low_income",
        decision="review",
        reason_code="THIN_FILE_LOW_INCOME",
        fcra_code="AA-07",
        # Thin-file applicant (no score) with income below $40k → manual review.
        # Use income_raw for the same floating-point safety reason.
        predicate=lambda f: f["thin_file_flag"] == 1.0 and float(f.get("income_raw", 0)) < 40_000,
    ),
]


def evaluate(features: dict) -> Optional[RuleResult]:
    """Return the first triggered rule result, or ``None`` if all rules pass.

    Args:
        features: Output dict from ``feature_engineering.transform()``.

    Returns:
        The first matching ``RuleResult`` in priority order, or ``None``.
    """
    for rule in RULES:
        result = rule.evaluate(features)
        if result is not None:
            return result
    return None

