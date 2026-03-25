"""AgentHive External AI Product Integration Gateway — Phase 4.

This package provides the plug-and-play integration layer for any
FastAPI-based AI service to appear as a first-class product inside
the AgentHive Lab without modifying platform source code.

Sub-modules
-----------
schemas         — Pydantic models: ProductManifest, InvokeRequest, NormalisedResponse
registry        — YAML manifest loader + in-memory product registry
proxy           — Async httpx secure proxy with auth injection, timeout, rate-limiting
health_monitor  — Background task polling /health on every registered product
router          — FastAPI routes: /api/integrations (list, invoke, schema, admin CRUD)
"""
