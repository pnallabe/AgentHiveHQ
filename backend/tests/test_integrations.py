"""Unit tests for the Integration Gateway endpoints (/api/integrations)."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest.mark.asyncio
class TestIntegrationsGateway:
    """Test suite for /api/integrations endpoints."""

    async def test_list_integrations_returns_200(self, client: AsyncClient):
        response = await client.get("/api/integrations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_get_nonexistent_integration_returns_404(self, client: AsyncClient):
        response = await client.get("/api/integrations/nonexistent-product-123")
        assert response.status_code == 404
        data = response.json()
        assert data["status"] == 404
        assert "not-found" in data["type"]

    async def test_get_schema_nonexistent_product_returns_404(self, client: AsyncClient):
        response = await client.get("/api/integrations/nonexistent-product-123/schema")
        assert response.status_code == 404

    async def test_invoke_nonexistent_product_returns_404(self, client: AsyncClient):
        payload = {
            "inputs": {"applicant_id": "app_123"},
            "demo_mode": True,
        }
        response = await client.post("/api/integrations/nonexistent-product-123/invoke", json=payload)
        assert response.status_code == 404

    async def test_register_and_deregister_product(self, client: AsyncClient):
        manifest_payload = {
            "manifest": {
                "product_id": "test-dummy-product",
                "display_name": "Test Dummy Product",
                "version": "1.0.0",
                "description": "Dummy product for integration gateway unit testing.",
                "owner_team": "Risk Engineering",
                "contact_email": "risk@agenthive.ai",
                "status": "beta",
                "category": "credit_card",
                "base_url": "http://localhost:9999",
                "health_check_path": "/health",
                "invoke_path": "/api/v1/score",
                "schema_path": "/openapi.json",
                "demo_mode_supported": True,
            }
        }

        # 1. Register new product
        reg_response = await client.post("/api/integrations", json=manifest_payload)
        assert reg_response.status_code in (201, 409)

        if reg_response.status_code == 201:
            data = reg_response.json()
            assert data["product_id"] == "test-dummy-product"

            # 2. Verify get_integration returns 200
            get_response = await client.get("/api/integrations/test-dummy-product")
            assert get_response.status_code == 200
            assert get_response.json()["product_id"] == "test-dummy-product"

            # 3. Clean up — Deregister product
            del_response = await client.delete("/api/integrations/test-dummy-product?delete_file=true")
            assert del_response.status_code == 200
            assert del_response.json()["product_id"] == "test-dummy-product"
