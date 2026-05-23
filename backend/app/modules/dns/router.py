"""DNS management router — Cloudflare v4 API.

All endpoints require a valid CF_API_TOKEN in env (or per-request header
override).  Zone is resolved from env CF_ZONE_ID by default; pass
?zone_id=XXX to target a different zone.

Routes
------
GET    /api/dns/zones                    — list all zones
GET    /api/dns/zones/{zone_id}          — zone detail
GET    /api/dns/records                  — list records (filter by type/name)
GET    /api/dns/records/{record_id}      — get single record
POST   /api/dns/records                  — create record
PUT    /api/dns/records/{record_id}      — replace record
PATCH  /api/dns/records/{record_id}      — partial update
DELETE /api/dns/records/{record_id}      — delete record
POST   /api/dns/records/upsert           — create-or-update by (type, name)
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.core.config import settings
from integrations import cloudflare as cf
from .schemas import (
    CreateRecordRequest,
    DeleteResult,
    DNSRecord,
    PatchRecordRequest,
    UpdateRecordRequest,
    UpsertRecordRequest,
    ZoneSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dns", tags=["DNS Management"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _token(x_cf_api_token: Optional[str]) -> str:
    """Resolve API token: header override → env var."""
    token = x_cf_api_token or settings.CF_API_TOKEN
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cloudflare API token not configured.  "
                "Set CF_API_TOKEN in .env or pass X-CF-Api-Token header."
            ),
        )
    return token


def _zone(zone_id: Optional[str], x_cf_zone_id: Optional[str]) -> str:
    """Resolve zone: query param → header → env var."""
    z = zone_id or x_cf_zone_id or settings.CF_ZONE_ID
    if not z:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cloudflare Zone ID not configured.  "
                "Set CF_ZONE_ID in .env, pass ?zone_id= query param, "
                "or X-CF-Zone-Id header."
            ),
        )
    return z


async def _wrap(coro):
    """Execute a CF coroutine and convert errors to HTTPExceptions."""
    try:
        return await coro
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except Exception as exc:
        logger.exception("Cloudflare API unexpected error")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


# ---------------------------------------------------------------------------
# Zone endpoints
# ---------------------------------------------------------------------------

@router.get("/zones", response_model=list[ZoneSummary], summary="List Cloudflare zones")
async def list_zones(
    name: Optional[str] = Query(default=None, description="Filter by domain name"),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
):
    """Return all zones accessible to the configured API token."""
    token = _token(x_cf_api_token)
    zones = await _wrap(cf.list_zones(token, name=name))
    return zones


@router.get("/zones/{zone_id}", response_model=ZoneSummary, summary="Get zone detail")
async def get_zone(
    zone_id: str,
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
):
    """Return details for a specific zone (by ID)."""
    token = _token(x_cf_api_token)
    zones = await _wrap(cf.list_zones(token))
    match = next((z for z in zones if z["id"] == zone_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found.")
    return match


# ---------------------------------------------------------------------------
# DNS Record endpoints
# ---------------------------------------------------------------------------

@router.get("/records", response_model=list[DNSRecord], summary="List DNS records")
async def list_records(
    record_type: Optional[str] = Query(default=None, alias="type", description="Filter by record type (A, CNAME, TXT …)"),
    name: Optional[str] = Query(default=None, description="Filter by record name"),
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """List all DNS records for the configured zone, with optional filters."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    return await _wrap(cf.list_records(token, zid, record_type=record_type, name=name))


@router.get("/records/{record_id}", response_model=DNSRecord, summary="Get a DNS record")
async def get_record(
    record_id: str,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    return await _wrap(cf.get_record(token, zid, record_id))


@router.post(
    "/records",
    response_model=DNSRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Create a DNS record",
)
async def create_record(
    body: CreateRecordRequest,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """Create a new DNS record in the zone."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    return await _wrap(cf.create_record(
        token, zid,
        record_type=body.type,
        name=body.name,
        content=body.content,
        ttl=body.ttl,
        proxied=body.proxied,
        priority=body.priority,
        comment=body.comment,
    ))


@router.put("/records/{record_id}", response_model=DNSRecord, summary="Replace a DNS record")
async def update_record(
    record_id: str,
    body: UpdateRecordRequest,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """Fully replace a DNS record (PUT semantics)."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    return await _wrap(cf.update_record(
        token, zid, record_id,
        record_type=body.type,
        name=body.name,
        content=body.content,
        ttl=body.ttl,
        proxied=body.proxied,
        priority=body.priority,
        comment=body.comment,
    ))


@router.patch("/records/{record_id}", response_model=DNSRecord, summary="Partially update a DNS record")
async def patch_record(
    record_id: str,
    body: PatchRecordRequest,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """Update only the supplied fields on an existing record."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update.")
    return await _wrap(cf.patch_record(token, zid, record_id, **fields))


@router.delete(
    "/records/{record_id}",
    response_model=DeleteResult,
    summary="Delete a DNS record",
)
async def delete_record(
    record_id: str,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """Permanently delete a DNS record."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    deleted_id = await _wrap(cf.delete_record(token, zid, record_id))
    return DeleteResult(id=deleted_id)


@router.post(
    "/records/upsert",
    response_model=DNSRecord,
    summary="Upsert a DNS record",
)
async def upsert_record(
    body: UpsertRecordRequest,
    zone_id: Optional[str] = Query(default=None),
    x_cf_api_token: Optional[str] = Header(default=None, alias="X-CF-Api-Token"),
    x_cf_zone_id: Optional[str] = Header(default=None, alias="X-CF-Zone-Id"),
):
    """Create a record or update it if a record with the same (type, name) already exists."""
    token = _token(x_cf_api_token)
    zid = _zone(zone_id, x_cf_zone_id)
    return await _wrap(cf.upsert_record(
        token, zid,
        record_type=body.type,
        name=body.name,
        content=body.content,
        ttl=body.ttl,
        proxied=body.proxied,
        priority=body.priority,
        comment=body.comment,
    ))
