"""Shared FastAPI dependency functions.

Usage
-----
    from app.core.dependencies import require_firebase_user, require_executive_role

    @router.get("/protected")
    async def endpoint(_: dict = Depends(require_firebase_user)):
        ...
"""
from __future__ import annotations

import asyncio
import logging
import os

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_db

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Demo / dev bypass
#   Set ANALYTICS_SKIP_AUTH=true to bypass token verification in local dev.
#   NEVER set this in staging or production.
# ---------------------------------------------------------------------------
_SKIP_AUTH = os.environ.get("ANALYTICS_SKIP_AUTH", "false").lower() == "true"


def _extract_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> str:
    """Extract bearer token from the Authorization header.

    Raises HTTP 401 if the header is absent or malformed.
    """
    if _SKIP_AUTH:
        return "__dev__"
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected: 'Bearer <firebase-id-token>'",
        )
    return credentials.credentials


def get_firebase_token(token: str = Depends(_extract_token)) -> dict:
    """Verify the Firebase ID token and return decoded claims.

    Returns a stub dict ``{"role": "executive"}`` when ``ANALYTICS_SKIP_AUTH=true``.
    """
    if _SKIP_AUTH:
        logger.debug("ANALYTICS_SKIP_AUTH=true — bypassing Firebase token verification")
        return {"role": "executive", "uid": "dev-user", "email": "dev@localhost"}

    try:
        from app.core.firebase_admin import verify_id_token

        return verify_id_token(token)
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail="Firebase token verification failed. Ensure the token is valid and not expired.",
        ) from exc


async def require_firebase_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> dict:
    """Async FastAPI dependency that verifies a Firebase ID token.

    Reads the ``Authorization: Bearer <token>`` header, verifies the token
    using the Firebase Admin SDK (off the event loop via ``asyncio.to_thread``),
    and returns the decoded claims dict (contains ``uid``, ``email``, etc.).

    Raises HTTP 401 for missing/malformed headers or invalid tokens.
    Both underwriting and governance endpoints require this dependency.
    """
    if _SKIP_AUTH:
        logger.debug("ANALYTICS_SKIP_AUTH=true — bypassing Firebase token verification")
        return {"role": "executive", "uid": "dev-user", "email": "dev@localhost"}

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
        )
    token = credentials.credentials

    try:
        from app.core.firebase_admin import verify_id_token

        return await asyncio.to_thread(verify_id_token, token)
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase token",
        ) from exc


def require_executive_role(
    claims: dict = Depends(get_firebase_token),
) -> dict:
    """Require the authenticated user to have ``role='executive'`` in their Firebase custom claims.

    Returns the full claims dict on success so downstream handlers can
    read ``uid``, ``email``, etc.

    Raises HTTP 403 for authenticated but non-executive users.
    Raises HTTP 401 for missing / invalid tokens (from ``get_firebase_token``).
    """
    role = (claims or {}).get("role", "")
    if role != "executive":
        raise HTTPException(
            status_code=403,
            detail=(
                "Executive role required. "
                "Contact your administrator to request access, or use the admin "
                "panel to set the 'executive' custom claim on your Firebase account."
            ),
        )
    return claims


# ---------------------------------------------------------------------------
# Tenant resolution
#
# Tenant identity comes from Firebase custom claims (set by the Admin SDK at
# provisioning time) and is verified against the tenant_memberships table.
# The frontend NEVER supplies the tenant — client-side tenant selectors are
# display-only.
# ---------------------------------------------------------------------------

#: Roles in descending privilege order. ``auditor`` is read-only.
TENANT_ROLES = ("admin", "risk_manager", "underwriter", "auditor")


@dataclass(frozen=True)
class TenantContext:
    """Resolved, verified tenant identity for the current request."""

    tenant_id: str
    slug: str
    user_uid: str
    email: Optional[str]
    role: str


def _slug_from_claims(claims: dict) -> Optional[str]:
    """Extract a tenant slug from Firebase custom claims.

    Accepts the same claim shapes the frontend routing layer understands:
    ``tenant_slug`` / ``tenantSlug`` / ``tenant_id`` / ``tenantId`` or the
    first entry of a ``tenants`` membership array.
    """
    if not claims:
        return None
    for key in ("tenant_slug", "tenantSlug", "tenant_id", "tenantId"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    tenants = claims.get("tenants")
    if isinstance(tenants, list) and tenants:
        first = tenants[0]
        if isinstance(first, str) and first.strip():
            return first.strip().lower()
        if isinstance(first, dict):
            for key in ("slug", "tenantSlug", "tenant_slug", "tenant_id", "tenantId", "id"):
                value = first.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip().lower()
    return None


async def _resolve_tenant(claims: dict, db) -> Optional[TenantContext]:
    """Look up the tenant + membership for the claims' slug. None if unlinked."""
    from sqlalchemy import select

    from app.shared.db_models import Tenant, TenantMembership

    slug = _slug_from_claims(claims)
    if not slug:
        return None

    tenant_result = await db.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.status == "active")
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        return None

    uid = str(claims.get("uid", ""))
    membership_result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_uid == uid,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        return None

    return TenantContext(
        tenant_id=tenant.id,
        slug=tenant.slug,
        user_uid=uid,
        email=claims.get("email") or membership.email,
        role=membership.role,
    )


async def optional_tenant(
    claims: dict = Depends(require_firebase_user),
    db=Depends(get_db),
) -> Optional[TenantContext]:
    """Resolve the tenant if the user is linked to one; otherwise None.

    Never raises — used on endpoints (e.g. underwriting) that must keep
    serving unauthenticated-sandbox / pre-tenant traffic during migration.
    """
    if _SKIP_AUTH:
        return None
    try:
        return await _resolve_tenant(claims, db)
    except Exception as exc:  # noqa: BLE001 — resolution failure must not 500 the request
        logger.warning("optional_tenant resolution failed: %s", exc)
        return None


async def require_tenant(
    claims: dict = Depends(require_firebase_user),
    db=Depends(get_db),
) -> TenantContext:
    """Require a verified tenant membership. 403 when unlinked."""
    if _SKIP_AUTH:
        return TenantContext(
            tenant_id="dev-tenant",
            slug="dev-tenant",
            user_uid="dev-user",
            email="dev@localhost",
            role="admin",
        )
    ctx = await _resolve_tenant(claims, db)
    if ctx is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your account is not linked to an active tenant. "
                "Contact your administrator or support to request access."
            ),
        )
    return ctx


def require_tenant_role(*allowed: str):
    """Build a dependency requiring one of the given tenant roles.

    Usage::

        @router.get("/admin-only")
        async def endpoint(ctx: TenantContext = Depends(require_tenant_role("admin"))):
            ...
    """
    invalid = set(allowed) - set(TENANT_ROLES)
    if invalid:
        raise ValueError(f"Unknown tenant role(s): {sorted(invalid)}")

    async def _checker(ctx: TenantContext = Depends(require_tenant)) -> TenantContext:
        if ctx.role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of: {', '.join(allowed)}.",
            )
        return ctx

    return _checker


# ---------------------------------------------------------------------------
# API-key authentication (programmatic access)
#
# Accepts ``X-AgentHive-Key: ahk_...`` as an alternative to a Firebase Bearer
# token. Resolves to a TenantContext with the key's tenant and a synthetic
# ``api-key`` role. Scope enforcement is applied by the calling endpoint.
# ---------------------------------------------------------------------------

_API_KEY_HEADER = "x-agenthive-key"


async def require_tenant_or_api_key(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db=Depends(get_db),
) -> TenantContext:
    """Resolve tenant from an API key header, falling back to Firebase auth.

    Precedence: ``X-AgentHive-Key`` header wins when present; otherwise the
    Firebase Bearer token path (``require_tenant``) is used.
    """
    if _SKIP_AUTH:
        return TenantContext(
            tenant_id="dev-tenant",
            slug="dev-tenant",
            user_uid="dev-user",
            email="dev@localhost",
            role="admin",
        )

    api_key = request.headers.get(_API_KEY_HEADER)
    if api_key:
        from app.modules.tenants.api_keys import verify_api_key  # noqa: PLC0415
        from app.shared.db_models import Tenant  # noqa: PLC0415
        from sqlalchemy import select  # noqa: PLC0415

        key = await verify_api_key(db, api_key)
        if key is None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API key")
        result = await db.execute(
            select(Tenant).where(Tenant.id == key.tenant_id, Tenant.status == "active")
        )
        tenant_row = result.scalar_one_or_none()
        if tenant_row is None:
            raise HTTPException(status_code=403, detail="Tenant is not active")
        return TenantContext(
            tenant_id=key.tenant_id,
            slug=tenant_row.slug,
            user_uid=f"api-key:{key.id}",
            email=None,
            role="api-key",
        )

    # Fall back to Firebase Bearer token.
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Provide X-AgentHive-Key or a Firebase Bearer token",
        )
    try:
        from app.core.firebase_admin import verify_id_token

        claims = await asyncio.to_thread(verify_id_token, credentials.credentials)
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token") from exc

    ctx = await _resolve_tenant(claims, db)
    if ctx is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not linked to an active tenant.",
        )
    return ctx
