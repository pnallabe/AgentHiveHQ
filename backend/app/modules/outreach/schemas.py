"""Pydantic schemas for the outreach engine API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ── Prospects ─────────────────────────────────────────────────────────────────
class ProspectIn(BaseModel):
    company: str = Field(min_length=1, max_length=256)
    email: EmailStr
    contact_name: str = Field(min_length=1, max_length=256)
    domain: Optional[str] = Field(default=None, max_length=256)
    title: Optional[str] = Field(default=None, max_length=256)
    segment: str = Field(default="fintech-lender", max_length=64)
    aum_band: Optional[str] = Field(default=None, max_length=32)
    notes: Optional[str] = None
    source: Optional[str] = Field(default=None, max_length=128)


class ProspectOut(BaseModel):
    id: str
    company: str
    email: str
    contact_name: str
    title: Optional[str]
    segment: str
    aum_band: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    created: int
    skipped_duplicates: int
    skipped_suppressed: int
    errors: list[str]


# ── Sequences / enrollment ────────────────────────────────────────────────────
class SequenceOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    steps: list
    active: bool

    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    prospect_ids: list[str] = Field(min_length=1)
    sequence: str = Field(default="exam-ready-v1", description="Sequence name")


class EnrollResult(BaseModel):
    enrolled: int
    skipped: list[str]


# ── Sequencer ─────────────────────────────────────────────────────────────────
class SequencerRunResult(BaseModel):
    dry_run: bool
    due: int
    sent: int
    failed: int
    suppressed: int
    skipped_rate_limit: int
    details: list[str]


# ── Stats ─────────────────────────────────────────────────────────────────────
class OutreachStats(BaseModel):
    prospects_by_status: dict[str, int]
    messages_by_status: dict[str, int]
    sent_last_7d: int
    open_rate: Optional[float]
    reply_rate: Optional[float]
    suppression_count: int
    active_enrollments: int
