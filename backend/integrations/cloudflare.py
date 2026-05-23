"""Cloudflare DNS API integration.

Wraps the Cloudflare v4 REST API for DNS record management.
Supports single-zone and multi-zone operations via a shared async httpx client.

Environment variables (configured in backend/.env):
    CF_API_TOKEN   – Cloudflare API Token with DNS:Edit + Zone:Read permissions
    CF_ZONE_ID     – Default zone ID (overridable per-call for multi-zone setups)

Cloudflare API reference:
    https://developers.cloudflare.com/api/resources/dns/subresources/records/
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

_CF_BASE = "https://api.cloudflare.com/client/v4"

# ---------------------------------------------------------------------------
# Shared client (lifecycle managed by FastAPI startup / shutdown)
# ---------------------------------------------------------------------------

_client: Optional[httpx.AsyncClient] = None


def _get_client(api_token: str) -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=_CF_BASE,
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            timeout=20.0,
            follow_redirects=True,
        )
    return _client


async def close_cloudflare_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        logger.info("Cloudflare HTTP client closed.")


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _raise_for_cf_error(data: dict[str, Any], response: httpx.Response) -> None:
    """Raise a descriptive RuntimeError when Cloudflare returns success=false."""
    if not data.get("success", False):
        errors = data.get("errors", [])
        msg = "; ".join(f"[{e.get('code')}] {e.get('message')}" for e in errors)
        raise RuntimeError(f"Cloudflare API error (HTTP {response.status_code}): {msg}")


# ---------------------------------------------------------------------------
# Zone helpers
# ---------------------------------------------------------------------------

async def list_zones(api_token: str, name: str | None = None) -> list[dict[str, Any]]:
    """Return all zones accessible to the token, optionally filtered by name."""
    client = _get_client(api_token)
    params: dict[str, Any] = {"per_page": 50}
    if name:
        params["name"] = name

    results: list[dict] = []
    page = 1
    while True:
        params["page"] = page
        resp = await client.get("/zones", params=params)
        resp.raise_for_status()
        data = resp.json()
        _raise_for_cf_error(data, resp)
        results.extend(data.get("result", []))
        result_info = data.get("result_info", {})
        if page >= result_info.get("total_pages", 1):
            break
        page += 1

    return results


async def get_zone_id(api_token: str, domain: str) -> str:
    """Resolve a domain name to its Cloudflare Zone ID."""
    # Try exact match first, then apex
    apex = ".".join(domain.split(".")[-2:])
    zones = await list_zones(api_token, name=apex)
    if not zones:
        raise ValueError(f"No Cloudflare zone found for domain '{domain}'")
    return zones[0]["id"]


# ---------------------------------------------------------------------------
# DNS Record CRUD
# ---------------------------------------------------------------------------

async def list_records(
    api_token: str,
    zone_id: str,
    record_type: str | None = None,
    name: str | None = None,
) -> list[dict[str, Any]]:
    """List DNS records for a zone.  Optionally filter by type and/or name."""
    client = _get_client(api_token)
    params: dict[str, Any] = {"per_page": 100}
    if record_type:
        params["type"] = record_type.upper()
    if name:
        params["name"] = name

    results: list[dict] = []
    page = 1
    while True:
        params["page"] = page
        resp = await client.get(f"/zones/{zone_id}/dns_records", params=params)
        resp.raise_for_status()
        data = resp.json()
        _raise_for_cf_error(data, resp)
        results.extend(data.get("result", []))
        result_info = data.get("result_info", {})
        if page >= result_info.get("total_pages", 1):
            break
        page += 1

    return results


async def get_record(api_token: str, zone_id: str, record_id: str) -> dict[str, Any]:
    """Fetch a single DNS record by ID."""
    client = _get_client(api_token)
    resp = await client.get(f"/zones/{zone_id}/dns_records/{record_id}")
    resp.raise_for_status()
    data = resp.json()
    _raise_for_cf_error(data, resp)
    return data["result"]


async def create_record(
    api_token: str,
    zone_id: str,
    record_type: str,
    name: str,
    content: str,
    ttl: int = 1,          # 1 = automatic
    proxied: bool = False,
    priority: int | None = None,  # required for MX / SRV
    comment: str = "",
) -> dict[str, Any]:
    """Create a new DNS record."""
    client = _get_client(api_token)
    payload: dict[str, Any] = {
        "type": record_type.upper(),
        "name": name,
        "content": content,
        "ttl": ttl,
        "proxied": proxied,
        "comment": comment,
    }
    if priority is not None:
        payload["priority"] = priority

    resp = await client.post(f"/zones/{zone_id}/dns_records", json=payload)
    resp.raise_for_status()
    data = resp.json()
    _raise_for_cf_error(data, resp)
    logger.info("Created %s record '%s' → %s in zone %s", record_type, name, content, zone_id)
    return data["result"]


async def update_record(
    api_token: str,
    zone_id: str,
    record_id: str,
    record_type: str,
    name: str,
    content: str,
    ttl: int = 1,
    proxied: bool = False,
    priority: int | None = None,
    comment: str = "",
) -> dict[str, Any]:
    """Replace (PUT) a DNS record entirely."""
    client = _get_client(api_token)
    payload: dict[str, Any] = {
        "type": record_type.upper(),
        "name": name,
        "content": content,
        "ttl": ttl,
        "proxied": proxied,
        "comment": comment,
    }
    if priority is not None:
        payload["priority"] = priority

    resp = await client.put(f"/zones/{zone_id}/dns_records/{record_id}", json=payload)
    resp.raise_for_status()
    data = resp.json()
    _raise_for_cf_error(data, resp)
    logger.info("Updated DNS record %s in zone %s", record_id, zone_id)
    return data["result"]


async def patch_record(
    api_token: str,
    zone_id: str,
    record_id: str,
    **fields: Any,
) -> dict[str, Any]:
    """Partially update a DNS record (PATCH — only send changed fields)."""
    client = _get_client(api_token)
    resp = await client.patch(f"/zones/{zone_id}/dns_records/{record_id}", json=fields)
    resp.raise_for_status()
    data = resp.json()
    _raise_for_cf_error(data, resp)
    logger.info("Patched DNS record %s in zone %s", record_id, zone_id)
    return data["result"]


async def delete_record(api_token: str, zone_id: str, record_id: str) -> str:
    """Delete a DNS record.  Returns the deleted record ID."""
    client = _get_client(api_token)
    resp = await client.delete(f"/zones/{zone_id}/dns_records/{record_id}")
    resp.raise_for_status()
    data = resp.json()
    _raise_for_cf_error(data, resp)
    deleted_id: str = data["result"]["id"]
    logger.info("Deleted DNS record %s from zone %s", deleted_id, zone_id)
    return deleted_id


# ---------------------------------------------------------------------------
# Convenience: upsert (create-or-update by name + type)
# ---------------------------------------------------------------------------

async def upsert_record(
    api_token: str,
    zone_id: str,
    record_type: str,
    name: str,
    content: str,
    ttl: int = 1,
    proxied: bool = False,
    priority: int | None = None,
    comment: str = "",
) -> dict[str, Any]:
    """Create a record if it doesn't exist, otherwise update the first match."""
    existing = await list_records(api_token, zone_id, record_type=record_type, name=name)
    if existing:
        return await update_record(
            api_token, zone_id, existing[0]["id"],
            record_type, name, content, ttl, proxied, priority, comment,
        )
    return await create_record(
        api_token, zone_id, record_type, name, content, ttl, proxied, priority, comment,
    )
