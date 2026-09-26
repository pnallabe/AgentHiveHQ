"""Unit tests for the Copilot API endpoint (/api/copilot/explain)."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest.mark.asyncio
class TestCopilotEndpoint:
    """Test suite for /api/copilot/explain."""

    async def test_explain_valid_decision_returns_200(self, client: AsyncClient):
        payload = {
            "decision_response": {
                "decision_id": "test-dec-123",
                "created_at": "2026-09-25T12:00:00Z",
                "decision": "approve",
                "credit_limit": 5000.0,
                "apr": 18.5,
                "risk_segment": "prime",
                "reason_codes": [],
                "explanations": {"annual_income": 0.45},
                "audit": {
                    "model_version": "v1.0.0",
                    "rules_triggered": [],
                    "latency_ms": 12.5,
                    "demo_mode": True,
                },
            },
            "applicant_context": "Software engineer, 30yo",
        }

        response = await client.post("/api/copilot/explain", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert "narrative" in data
        assert "risk_flags" in data
        assert "recommendations" in data
        assert "plain_english_apr" in data

        assert isinstance(data["narrative"], str)
        assert len(data["narrative"]) > 0
        assert isinstance(data["risk_flags"], list)
        assert isinstance(data["recommendations"], list)

    async def test_explain_rejected_decision_returns_risk_flags(self, client: AsyncClient):
        payload = {
            "decision_response": {
                "decision_id": "test-dec-456",
                "created_at": "2026-09-25T12:00:00Z",
                "decision": "reject",
                "credit_limit": None,
                "apr": None,
                "risk_segment": "subprime",
                "reason_codes": ["LOW_INCOME", "LOW_CREDIT_SCORE"],
                "explanations": {"annual_income": -0.55},
                "audit": {
                    "model_version": "v1.0.0",
                    "rules_triggered": ["RULE_001_LOW_SCORE"],
                    "latency_ms": 8.1,
                    "demo_mode": False,
                },
            },
        }

        response = await client.post("/api/copilot/explain", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["narrative"] is not None
