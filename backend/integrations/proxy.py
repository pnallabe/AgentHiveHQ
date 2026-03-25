"""Secure async proxy for external AI product calls.

Responsibilities
----------------
1. Inject authentication headers (API key / OAuth2 bearer) from env vars.
2. Enforce per-product request timeout.
3. Strip PII fields from input before writing to audit log.
4. Forward request to external /invoke endpoint via httpx.
5. Validate response against NormalisedResponse (lenient — extras go to raw_extra).
6. Rate-limit calls per product_id (in-memory token bucket; swap for Redis in prod).
7. Return NormalisedResponse to the router; never expose raw upstream errors to clients.

Thread safety
-------------
httpx.AsyncClient is shared and re-used across requests (connection pooling).
The client is created on first use and closed during FastAPI shutdown.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from pydantic import ValidationError

from integrations.schemas import (
    AuditBlock,
    AuthType,
    InvokeRequest,
    NormalisedResponse,
    ProductManifest,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared httpx client (lifecycle managed by startup/shutdown hooks)
# ---------------------------------------------------------------------------

_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            follow_redirects=True,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _client


async def close_http_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        logger.info("Integration proxy HTTP client closed")


# ---------------------------------------------------------------------------
# In-memory rate limiter (token bucket, per product_id)
# ---------------------------------------------------------------------------

class _TokenBucket:
    """Simple in-memory token bucket for rate limiting.

    Not distributed — swap for Redis INCR + EXPIRE in multi-process deployments.
    """

    def __init__(self, rate_rpm: int) -> None:
        self._rate_per_sec = rate_rpm / 60.0
        self._tokens = float(rate_rpm)
        self._max_tokens = float(rate_rpm)
        self._last_refill = time.monotonic()

    def consume(self) -> bool:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(
            self._max_tokens,
            self._tokens + elapsed * self._rate_per_sec,
        )
        self._last_refill = now
        if self._tokens >= 1.0:
            self._tokens -= 1.0
            return True
        return False


_rate_limiters: dict[str, _TokenBucket] = defaultdict(lambda: _TokenBucket(60))  # default 60 rpm


def _get_rate_limiter(product_id: str, rate_rpm: int) -> _TokenBucket:
    if product_id not in _rate_limiters:
        _rate_limiters[product_id] = _TokenBucket(rate_rpm)
    return _rate_limiters[product_id]


# ---------------------------------------------------------------------------
# Auth header builder
# ---------------------------------------------------------------------------

def _build_auth_headers(manifest: ProductManifest) -> dict[str, str]:
    """Resolve auth credentials from env vars and return HTTP headers."""
    headers: dict[str, str] = {
        "X-AgentHive-Product": manifest.product_id,
        "X-AgentHive-Source": "agenthive-gateway/1.0",
    }

    if manifest.auth_type == AuthType.NONE:
        return headers

    if not manifest.auth_secret_env_var:
        logger.warning(
            "Product %s has auth_type=%s but no auth_secret_env_var configured",
            manifest.product_id,
            manifest.auth_type,
        )
        return headers

    secret = os.getenv(manifest.auth_secret_env_var, "")
    if not secret:
        logger.error(
            "Auth env var %s for product %s is empty or unset",
            manifest.auth_secret_env_var,
            manifest.product_id,
        )
        return headers

    if manifest.auth_type == AuthType.API_KEY:
        headers["X-AgentHive-Key"] = secret
        headers["Authorization"] = f"Bearer {secret}"

    elif manifest.auth_type == AuthType.OAUTH2:
        # Treat the env var value as a pre-fetched bearer token.
        # In production, swap this for a proper token-refresh flow.
        headers["Authorization"] = f"Bearer {secret}"

    return headers


# ---------------------------------------------------------------------------
# PII scrubbing
# ---------------------------------------------------------------------------

def _strip_pii(inputs: dict[str, Any], pii_fields: list[str]) -> dict[str, Any]:
    """Return a copy of inputs with PII fields replaced by '<REDACTED>'."""
    if not pii_fields:
        return inputs
    scrubbed = dict(inputs)
    for field in pii_fields:
        if field in scrubbed:
            scrubbed[field] = "<REDACTED>"
    return scrubbed


# ---------------------------------------------------------------------------
# Core proxy function
# ---------------------------------------------------------------------------

class ProxyError(Exception):
    """Raised when the proxy cannot produce a valid NormalisedResponse."""

    def __init__(self, status: int, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail


async def proxy_invoke(
    manifest: ProductManifest,
    request: InvokeRequest,
) -> tuple[NormalisedResponse, dict[str, Any]]:
    """Forward an InvokeRequest to the external service and return a NormalisedResponse.

    Returns
    -------
    (normalised_response, audit_payload)
        audit_payload contains the scrubbed inputs and full audit chain.

    Raises
    ------
    ProxyError
        On rate-limit exceeded, upstream timeout, upstream error (4xx/5xx),
        or response parsing failure.
    """
    product_id = manifest.product_id

    # ── Rate limit check ──────────────────────────────────────────────────────
    limiter = _get_rate_limiter(product_id, manifest.rate_limit_rpm)
    if not limiter.consume():
        raise ProxyError(
            429,
            "Rate Limit Exceeded",
            f"Product '{product_id}' exceeded {manifest.rate_limit_rpm} requests/minute.",
        )

    # ── Prepare payload ───────────────────────────────────────────────────────
    upstream_payload: dict[str, Any] = {
        "inputs": request.inputs,
        "demo_mode": request.demo_mode,
        "scenario_tag": request.scenario_tag,
    }

    headers = _build_auth_headers(manifest)
    scrubbed_inputs = _strip_pii(request.inputs, manifest.pii_fields)

    start_ms = time.monotonic() * 1000

    client = get_http_client()

    try:
        response = await client.post(
            manifest.invoke_url,
            json=upstream_payload,
            headers=headers,
            timeout=manifest.timeout_seconds,
        )
    except httpx.TimeoutException as exc:
        raise ProxyError(
            504,
            "Upstream Timeout",
            f"Product '{product_id}' did not respond within {manifest.timeout_seconds}s.",
        ) from exc
    except httpx.RequestError as exc:
        raise ProxyError(
            502,
            "Bad Gateway",
            f"Network error reaching product '{product_id}': {exc}",
        ) from exc

    latency_ms = time.monotonic() * 1000 - start_ms

    # ── Upstream error ────────────────────────────────────────────────────────
    if not response.is_success:
        logger.warning(
            "Upstream error from %s: HTTP %d — %s",
            product_id,
            response.status_code,
            response.text[:500],
        )
        raise ProxyError(
            502,
            "Upstream Error",
            f"Product '{product_id}' returned HTTP {response.status_code}.",
        )

    # ── Parse response ────────────────────────────────────────────────────────
    try:
        raw_body: dict[str, Any] = response.json()
    except Exception as exc:
        raise ProxyError(
            502,
            "Invalid Response",
            f"Product '{product_id}' returned non-JSON response.",
        ) from exc

    # Inject gateway-level audit fields if upstream didn't supply them
    raw_body.setdefault("decision_id", None)
    raw_body.setdefault("source", "external")
    raw_body["product_id"] = product_id

    audit_from_upstream: dict[str, Any] = raw_body.pop("audit", {})
    audit_from_upstream["latency_ms"] = latency_ms
    audit_from_upstream.setdefault("timestamp", datetime.now(tz=timezone.utc).isoformat())
    audit_from_upstream.setdefault("model_version", "unknown")
    raw_body["audit"] = audit_from_upstream

    try:
        normalised = NormalisedResponse.model_validate(raw_body)
    except ValidationError as exc:
        logger.error("Response from %s failed normalisation: %s", product_id, exc)
        raise ProxyError(
            502,
            "Contract Violation",
            f"Product '{product_id}' response does not match the required contract. "
            "Missing 'decision' or 'summary' field.",
        ) from exc

    # ── Audit payload (safe to log — PII scrubbed) ────────────────────────────
    audit_payload = {
        "product_id": product_id,
        "inputs": scrubbed_inputs,
        "decision": normalised.decision,
        "decision_id": normalised.decision_id,
        "latency_ms": latency_ms,
        "demo_mode": request.demo_mode,
        "scenario_tag": request.scenario_tag,
        "model_version": normalised.audit.model_version,
    }

    logger.info(
        "Proxy invoke success",
        extra={
            "product_id": product_id,
            "decision": normalised.decision,
            "latency_ms": round(latency_ms, 1),
        },
    )

    return normalised, audit_payload


# ---------------------------------------------------------------------------
# Health probe (used by health monitor)
# ---------------------------------------------------------------------------

async def probe_health(manifest: ProductManifest) -> bool:
    """Return True if the product's /health endpoint responds with status=ok."""
    client = get_http_client()
    try:
        response = await client.get(
            manifest.health_url,
            headers=_build_auth_headers(manifest),
            timeout=10.0,
        )
        if not response.is_success:
            return False
        body = response.json()
        return isinstance(body, dict) and body.get("status") == "ok"
    except Exception as exc:
        logger.debug("Health probe failed for %s: %s", manifest.product_id, exc)
        return False


# ---------------------------------------------------------------------------
# Schema fetch (used by GET /api/integrations/{product_id}/schema)
# ---------------------------------------------------------------------------

async def fetch_schema(manifest: ProductManifest) -> dict[str, Any]:
    """Return the OpenAPI JSON from the external product's /schema endpoint."""
    client = get_http_client()
    try:
        response = await client.get(
            manifest.schema_url,
            headers=_build_auth_headers(manifest),
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        raise ProxyError(
            502,
            "Schema Unavailable",
            f"Product '{manifest.product_id}' /schema returned HTTP {exc.response.status_code}.",
        ) from exc
    except Exception as exc:
        raise ProxyError(
            502,
            "Schema Unavailable",
            f"Could not fetch schema for '{manifest.product_id}': {exc}",
        ) from exc
