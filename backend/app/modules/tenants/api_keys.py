"""Tenant API key lifecycle — generation, hashing, verification.

Keys look like:  ``ahk_<prefix8>_<secret32>``
Only the SHA-256 hex digest of the full key is stored. The plaintext is
returned exactly once at creation time.
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.db_models import TenantApiKey

_PREFIX = "ahk"


@dataclass(frozen=True)
class GeneratedKey:
    """The one-time plaintext key plus its persistable parts."""

    plaintext: str
    prefix: str
    key_hash: str


def generate_api_key() -> GeneratedKey:
    """Generate a new API key. Plaintext is shown once, never stored."""
    secret = secrets.token_urlsafe(24)  # ~32 chars, URL-safe
    prefix = secrets.token_hex(4)       # 8 hex chars, for list identification
    plaintext = f"{_PREFIX}_{prefix}_{secret}"
    return GeneratedKey(
        plaintext=plaintext,
        prefix=f"{_PREFIX}_{prefix}",
        key_hash=hash_key(plaintext),
    )


def hash_key(plaintext: str) -> str:
    """SHA-256 hex digest of a full API key."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


async def verify_api_key(
    db: AsyncSession, plaintext: str
) -> Optional[TenantApiKey]:
    """Resolve an active (non-revoked) API key, updating last_used_at.

    Returns None for unknown or revoked keys.
    """
    if not plaintext or not plaintext.startswith(f"{_PREFIX}_"):
        return None
    digest = hash_key(plaintext)
    result = await db.execute(
        select(TenantApiKey).where(
            TenantApiKey.key_hash == digest,
            TenantApiKey.revoked_at.is_(None),
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        return None
    key.last_used_at = datetime.now(tz=timezone.utc)
    return key
