"""Integration tests for governance and decision-history endpoints.

Covers:
    Story 4.2 – GET /api/governance/dashboard
    Story 4.3 – GET /api/governance/bias-report
    Story 2.1 – GET /api/underwriting/history (pagination + filtering)
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DECISION_PAYLOAD = {
    "income": 75_000,
    "employment_length": 3.0,
    "housing_status": "mortgage",
    "credit_score": 720,
    "demo_mode": False,
}

_LOW_INCOME_PAYLOAD = {
    "income": 20_000,
    "employment_length": 0.5,
    "housing_status": "rent",
    "credit_score": 580,
    "demo_mode": False,
}


async def _seed_decisions(client: AsyncClient, n: int = 6) -> None:
    """POST n decisions to populate the history table."""
    for i in range(n):
        payload = _DECISION_PAYLOAD if i % 2 == 0 else _LOW_INCOME_PAYLOAD
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 200, f"Seed decision {i} failed: {resp.text}"


# ---------------------------------------------------------------------------
# History endpoint
# ---------------------------------------------------------------------------

class TestDecisionHistory:
    """GET /api/underwriting/history — pagination and filtering."""

    @pytest.mark.asyncio
    async def test_history_pagination(self, client: AsyncClient):
        """page_size is respected — response items length <= page_size."""
        await _seed_decisions(client, n=6)
        resp = await client.get("/api/underwriting/history", params={"page": 1, "page_size": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        assert len(data["items"]) <= 5

    @pytest.mark.asyncio
    async def test_history_filter_decision(self, client: AsyncClient):
        """decision=approve filter returns only approve records."""
        await _seed_decisions(client, n=6)
        resp = await client.get(
            "/api/underwriting/history",
            params={"decision": "approve", "page": 1, "page_size": 50},
        )
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["decision"] == "approve", (
                f"Expected 'approve', got '{item['decision']}'"
            )

    @pytest.mark.asyncio
    async def test_history_invalid_page_returns_422(self, client: AsyncClient):
        """page=0 violates ge=1 constraint → 422."""
        resp = await client.get("/api/underwriting/history", params={"page": 0})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Governance dashboard
# ---------------------------------------------------------------------------

class TestGovernanceDashboard:
    """GET /api/governance/dashboard."""

    @pytest.mark.asyncio
    async def test_dashboard_all_top_level_fields(self, client: AsyncClient):
        """Dashboard response must contain all required top-level keys."""
        await _seed_decisions(client)
        resp = await client.get(
            "/api/governance/dashboard", params={"period": "all_time"}
        )
        assert resp.status_code == 200
        data = resp.json()
        required_keys = {
            "period",
            "total_decisions",
            "approval_rate",
            "average_credit_limit",
            "average_apr",
            "decisions_by_segment",
            "approval_rate_by_segment",
            "top_reason_codes",
        }
        missing = required_keys - data.keys()
        assert not missing, f"Dashboard response missing keys: {missing}"

    @pytest.mark.asyncio
    async def test_dashboard_invalid_period_returns_422(self, client: AsyncClient):
        """An unrecognised period value must return 422."""
        resp = await client.get(
            "/api/governance/dashboard", params={"period": "last_999_days"}
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_dashboard_approval_rate_between_zero_and_one(
        self, client: AsyncClient
    ):
        """approval_rate must be a float in [0, 1]."""
        await _seed_decisions(client)
        resp = await client.get(
            "/api/governance/dashboard", params={"period": "all_time"}
        )
        assert resp.status_code == 200
        rate = resp.json()["approval_rate"]
        assert 0.0 <= rate <= 1.0, f"approval_rate out of range: {rate}"


# ---------------------------------------------------------------------------
# Governance bias report
# ---------------------------------------------------------------------------

class TestBiasReport:
    """GET /api/governance/bias-report."""

    @pytest.mark.asyncio
    async def test_bias_report_contains_disclaimer(self, client: AsyncClient):
        """Bias report must include a disclaimer string (FCRA compliance)."""
        resp = await client.get("/api/governance/bias-report")
        assert resp.status_code == 200
        data = resp.json()
        assert "disclaimer" in data
        assert isinstance(data["disclaimer"], str)
        assert len(data["disclaimer"]) > 0

    @pytest.mark.asyncio
    async def test_adverse_impact_ratio_in_valid_range(self, client: AsyncClient):
        """adverse_impact_ratio must be a float in [0, 1]."""
        await _seed_decisions(client, n=8)
        resp = await client.get("/api/governance/bias-report")
        assert resp.status_code == 200
        data = resp.json()
        assert "adverse_impact_ratio" in data
        ratio = data["adverse_impact_ratio"]
        assert isinstance(ratio, float), f"Expected float, got {type(ratio)}"
        assert 0.0 <= ratio <= 1.0, f"adverse_impact_ratio out of range: {ratio}"
