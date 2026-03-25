"""Integration tests for POST /api/underwriting/decision — Story 1.6."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


VALID_PAYLOAD = {
    "income": 75_000,
    "employment_length": 3.0,
    "housing_status": "mortgage",
    "credit_score": 720,
    "demo_mode": False,
}


class TestDecisionEndpoint:
    """Happy-path and schema-validation tests."""

    @pytest.mark.asyncio
    async def test_valid_payload_returns_200(self, client: AsyncClient):
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_response_contains_decision_id(self, client: AsyncClient):
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        assert "decision_id" in data
        assert len(data["decision_id"]) == 36  # UUID4 format

    @pytest.mark.asyncio
    async def test_response_decision_is_valid_enum(self, client: AsyncClient):
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        assert data["decision"] in {"approve", "reject", "review"}

    @pytest.mark.asyncio
    async def test_response_contains_audit(self, client: AsyncClient):
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        assert "audit" in data
        assert "timestamp" in data["audit"]
        assert "model_version" in data["audit"]
        assert "processing_time_ms" in data["audit"]

    @pytest.mark.asyncio
    async def test_approved_decision_has_credit_limit(self, client: AsyncClient):
        """A prime applicant should be approved with a non-null credit limit."""
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        if data["decision"] == "approve":
            assert data["credit_limit"] is not None
            assert data["apr"] is not None

    @pytest.mark.asyncio
    async def test_credit_limit_rounded_to_500(self, client: AsyncClient):
        """Credit limits must always be multiples of $500."""
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        if data["credit_limit"] is not None:
            assert data["credit_limit"] % 500 == 0

    @pytest.mark.asyncio
    async def test_deterministic_output(self, client: AsyncClient):
        """Same input must produce same decision (model is deterministic)."""
        r1 = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        r2 = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        assert r1.json()["decision"] == r2.json()["decision"]

    @pytest.mark.asyncio
    async def test_explanations_present(self, client: AsyncClient):
        resp = await client.post("/api/underwriting/decision", json=VALID_PAYLOAD)
        data = resp.json()
        assert isinstance(data["explanations"], dict)
        assert len(data["explanations"]) > 0


class TestValidationErrors:
    """Invalid inputs must return 422 with RFC 7807-compatible body."""

    @pytest.mark.asyncio
    async def test_negative_income_returns_422(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "income": -1}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_housing_status_returns_422(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "housing_status": "condo"}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_credit_score_below_300_returns_422(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "credit_score": 299}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_credit_score_above_850_returns_422(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "credit_score": 851}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 422


class TestRulesOverride:
    """Hard rules must override the ML model when they fire."""

    @pytest.mark.asyncio
    async def test_low_income_is_rejected(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "income": 10_000}
        resp = await client.post("/api/underwriting/decision", json=payload)
        data = resp.json()
        assert data["decision"] == "reject"
        assert any(rc["fcra_code"] == "AA-01" for rc in data["reason_codes"])

    @pytest.mark.asyncio
    async def test_very_low_credit_score_is_rejected(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "income": 80_000, "credit_score": 490}
        resp = await client.post("/api/underwriting/decision", json=payload)
        data = resp.json()
        assert data["decision"] == "reject"
        assert any(rc["fcra_code"] == "AA-02" for rc in data["reason_codes"])


class TestDemoMode:
    """Demo mode must return deterministic, pre-computed responses."""

    @pytest.mark.asyncio
    async def test_prime_applicant_demo(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "demo_mode": True, "scenario_tag": "prime_applicant"}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "approve"
        assert data["audit"]["model_version"] == "demo-1.0.0"

    @pytest.mark.asyncio
    async def test_high_risk_demo_is_rejected(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "demo_mode": True, "scenario_tag": "high_risk"}
        resp = await client.post("/api/underwriting/decision", json=payload)
        data = resp.json()
        assert data["decision"] == "reject"

    @pytest.mark.asyncio
    async def test_thin_file_demo_is_review(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "demo_mode": True, "scenario_tag": "thin_file"}
        resp = await client.post("/api/underwriting/decision", json=payload)
        data = resp.json()
        assert data["decision"] == "review"

    @pytest.mark.asyncio
    async def test_unknown_scenario_tag_returns_fallback(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "demo_mode": True, "scenario_tag": "nonexistent_scenario"}
        resp = await client.post("/api/underwriting/decision", json=payload)
        assert resp.status_code == 200  # Should not 500

    @pytest.mark.asyncio
    async def test_demo_response_is_deterministic(self, client: AsyncClient):
        payload = {**VALID_PAYLOAD, "demo_mode": True, "scenario_tag": "near_prime"}
        r1 = await client.post("/api/underwriting/decision", json=payload)
        r2 = await client.post("/api/underwriting/decision", json=payload)
        assert r1.json()["decision"] == r2.json()["decision"]
        assert r1.json()["credit_limit"] == r2.json()["credit_limit"]


class TestHealth:
    """Health endpoint sanity check."""

    @pytest.mark.asyncio
    async def test_health_returns_200(self, client: AsyncClient):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
