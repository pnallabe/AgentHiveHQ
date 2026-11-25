"""Pydantic schemas for the tenant-inquiry intake endpoint.

The frontend signup form posts camelCase keys (``useCase``); aliases keep the
public contract stable while the ORM uses snake_case.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TenantInquiryRequest(BaseModel):
    """Payload from the public /signup interest form."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=256)
    email: EmailStr
    company: str = Field(min_length=1, max_length=256)
    title: Optional[str] = Field(default=None, max_length=256)
    use_case: str = Field(alias="useCase", min_length=1, max_length=500)
    volume: Optional[str] = Field(default=None, max_length=32)
    referral: Optional[str] = Field(default=None, max_length=256)


class TenantInquiryResponse(BaseModel):
    """Acknowledgement returned to the browser."""

    id: str
    status: str = "new"
    detail: str = "Thank you — our team typically responds within 1 business day."
