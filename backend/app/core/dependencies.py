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

from fastapi import Depends, Header, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Demo / dev bypass
#   Set ANALYTICS_SKIP_AUTH=true to bypass token verification in local dev.
#   NEVER set this in staging or production.
# ---------------------------------------------------------------------------
_SKIP_AUTH = os.environ.get("ANALYTICS_SKIP_AUTH", "false").lower() == "true"


def _extract_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
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
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
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
