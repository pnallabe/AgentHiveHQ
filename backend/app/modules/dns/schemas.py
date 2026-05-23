"""Pydantic schemas for the Cloudflare DNS management module."""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Supported DNS record types
# ---------------------------------------------------------------------------

class RecordType(str, Enum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    TXT = "TXT"
    MX = "MX"
    NS = "NS"
    SRV = "SRV"
    CAA = "CAA"
    PTR = "PTR"


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CreateRecordRequest(BaseModel):
    type: RecordType = Field(..., description="DNS record type")
    name: str = Field(..., description="Record name, e.g. 'www' or '@' for apex")
    content: str = Field(..., description="Record value, e.g. IP address or hostname")
    ttl: int = Field(default=1, ge=1, description="TTL in seconds; 1 = automatic")
    proxied: bool = Field(default=False, description="Route traffic through Cloudflare proxy")
    priority: Optional[int] = Field(default=None, description="Priority (MX / SRV only)")
    comment: str = Field(default="", description="Optional human-readable comment")

    model_config = {"json_schema_extra": {
        "example": {
            "type": "A",
            "name": "www",
            "content": "76.76.21.21",
            "ttl": 1,
            "proxied": True,
            "comment": "Production frontend",
        }
    }}


class UpdateRecordRequest(CreateRecordRequest):
    """Same fields as create — PUT replaces the entire record."""
    pass


class PatchRecordRequest(BaseModel):
    """Partial update — only supply fields you want to change."""
    content: Optional[str] = None
    ttl: Optional[int] = Field(default=None, ge=1)
    proxied: Optional[bool] = None
    comment: Optional[str] = None


class UpsertRecordRequest(CreateRecordRequest):
    """Create-or-update by (type, name) match."""
    pass


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DNSRecord(BaseModel):
    id: str
    type: str
    name: str
    content: str
    ttl: int
    proxied: bool
    proxiable: bool
    comment: Optional[str] = None
    created_on: Optional[str] = None
    modified_on: Optional[str] = None
    zone_id: str
    zone_name: Optional[str] = None

    model_config = {"extra": "allow"}   # forward-compat with extra CF fields


class ZoneSummary(BaseModel):
    id: str
    name: str
    status: str
    name_servers: list[str] = Field(default_factory=list)
    original_name_servers: list[str] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class DeleteResult(BaseModel):
    id: str
    message: str = "Record deleted successfully"
