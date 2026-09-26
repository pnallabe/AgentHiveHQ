"""Tests for CORS middleware behavior and allowed origins."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app

app = create_app()

@pytest.mark.asyncio
async def test_cors_preflight_allowed_origin():
    """Verify OPTIONS preflight request from production origin returns access-control-allow-origin header."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/underwriting/decision",
            headers={
                "Origin": "https://agenthivehq.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://agenthivehq.com"
        assert "POST" in response.headers.get("access-control-allow-methods", "")

@pytest.mark.asyncio
async def test_cors_preflight_firebase_origin():
    """Verify OPTIONS preflight request from Firebase app origin is allowed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/underwriting/decision",
            headers={
                "Origin": "https://agenthivehq-landing.firebaseapp.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://agenthivehq-landing.firebaseapp.com"

@pytest.mark.asyncio
async def test_cors_preflight_disallowed_origin():
    """Verify preflight from an unlisted domain does NOT return Access-Control-Allow-Origin."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/underwriting/decision",
            headers={
                "Origin": "https://malicious-domain.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-origin") is None
