"""
Scenario Config Proxy — Section 19.11
======================================
Re-exports CC_SCENARIOS from the credit-risk-platform models package for use
within the AgentHiveHQ backend.

All Section 19 scenario definitions live in credit-risk-platform/models/pricing/
as the single source of truth.  This module simply exposes them for use in the
AgentHiveHQ FastAPI layer without duplication.

Usage
-----
    from app.modules.analytics.scenario_config_proxy import CC_SCENARIOS, ScenarioKey
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure credit-risk-platform is importable when running from AgentHiveHQ backend
try:
    _CRP_ROOT = Path(__file__).resolve().parents[6] / "credit-risk-platform"
    if _CRP_ROOT.exists() and str(_CRP_ROOT) not in sys.path:
        sys.path.insert(0, str(_CRP_ROOT))
except IndexError:
    _CRP_ROOT = None

try:
    from models.pricing.scenario_config import CC_SCENARIOS, ScenarioKey, SCENARIO_KEYS

except ImportError:
    # Inline fallback so the API can still start without the full platform installed
    import os
    from typing import Literal

    ScenarioKey = Literal["base", "industry_worsening", "recession"]  # type: ignore[misc]
    SCENARIO_KEYS = ("base", "industry_worsening", "recession")

    CC_SCENARIOS = {
        "base": {
            "label": "Base",
            "description": "Stable macro environment (base case).",
            "annual_default_rate_mult": 1.00,
            "ftp_spread_bps": 0,
            "spend_volume_mult": 1.00,
            "payment_rate_mult": 1.00,
            "attrition_mult": 1.00,
            "capital_headroom_pct": 1.00,
            "probability_weight": 0.55,
        },
        "industry_worsening": {
            "label": "Industry Worsening",
            "description": "Moderate macro stress; unemployment drifts higher.",
            "annual_default_rate_mult": 1.22,
            "ftp_spread_bps": 40,
            "spend_volume_mult": 0.94,
            "payment_rate_mult": 0.91,
            "attrition_mult": 1.12,
            "capital_headroom_pct": 0.88,
            "probability_weight": 0.30,
        },
        "recession": {
            "label": "Recession",
            "description": "Severe macro stress; charge-offs spike 55-80% over base.",
            "annual_default_rate_mult": 1.72,
            "ftp_spread_bps": 90,
            "spend_volume_mult": 0.82,
            "payment_rate_mult": 0.78,
            "attrition_mult": 1.35,
            "capital_headroom_pct": 0.62,
            "probability_weight": 0.15,
        },
    }

__all__ = ["CC_SCENARIOS", "ScenarioKey", "SCENARIO_KEYS"]
