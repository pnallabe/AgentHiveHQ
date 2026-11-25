"""FastAPI router for enterprise SSO (SAML / OIDC) via WorkOS.

Mounted at: /api/v1
Wired in:   app/main.py

Flow (WorkOS AuthKit / SSO):
    1. Frontend calls GET /api/v1/sso/authorize?email=user@acme.com (or org/domain)
    2. Backend returns a WorkOS authorization URL
    3. User authenticates with their IdP (Okta, Entra, Google Workspace, etc.)
    4. WorkOS redirects to GET /api/v1/sso/callback?code=...
    5. Backend exchanges the code for a profile, resolves/provisions the tenant
       membership, and redirects to the frontend with a session signal

SCIM (directory sync) is configured in the WorkOS dashboard — the WorkOS
Directory Sync webhooks hit POST /api/v1/sso/scim/webhook to provision /
deprovision users as they join/leave the customer's IdP.

Until WORKOS_API_KEY + WORKOS_CLIENT_ID are configured, every endpoint returns
503 SSO_NOT_CONFIGURED so the frontend can hide the option.
"""
from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.database import get_db
from app.modules.underwriting.schemas import ProblemDetail

logger = get_logger(__name__)
router = APIRouter()

# ── Configuration ─────────────────────────────────────────────────────────────
WORKOS_API_KEY = os.environ.get("WORKOS_API_KEY", "")
WORKOS_CLIENT_ID = os.environ.get("WORKOS_CLIENT_ID", "")
#: Where to send the user after a successful SSO callback (frontend URL).
SSO_SUCCESS_REDIRECT = os.environ.get(
    "SSO_SUCCESS_REDIRECT", "https://agenthivehq.com/tenant-portal"
)
#: The WorkOS redirect URI registered in the WorkOS dashboard.
WORKOS_REDIRECT_URI = os.environ.get(
    "WORKOS_REDIRECT_URI",
    "https://agenthivehq-backend-api-311931689095.us-central1.run.app/api/v1/sso/callback",
)


def _configured() -> bool:
    return bool(WORKOS_API_KEY and WORKOS_CLIENT_ID)


def _not_configured(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content=ProblemDetail(
            type="https://agenthive.ai/errors/sso-not-configured",
            title="SSO Not Configured",
            status=503,
            detail=(
                "Enterprise SSO is not enabled on this deployment. "
                "Set WORKOS_API_KEY and WORKOS_CLIENT_ID to activate it."
            ),
            instance=str(request.url.path),
        ).model_dump(),
    )


# ── GET /sso/status ───────────────────────────────────────────────────────────

@router.get(
    "/sso/status",
    summary="SSO availability",
    description="Reports whether enterprise SSO is configured. The frontend uses this to show/hide the SSO button.",
)
async def sso_status() -> dict[str, Any]:
    return {
        "sso_enabled": _configured(),
        "provider": "workos" if _configured() else None,
        "scim_enabled": _configured(),  # Directory Sync shares the same credentials
    }


# ── GET /sso/authorize ────────────────────────────────────────────────────────

@router.get(
    "/sso/authorize",
    summary="Begin SSO authorization",
    description=(
        "Returns a WorkOS authorization URL for the given domain/organization. "
        "The frontend redirects the user to this URL to authenticate with their IdP."
    ),
)
async def sso_authorize(
    request: Request,
    email: Optional[str] = Query(default=None, description="User's work email (domain is used to route to their IdP)"),
    organization: Optional[str] = Query(default=None, description="WorkOS organization ID (if known)"),
    connection: Optional[str] = Query(default=None, description="WorkOS connection ID (if known)"),
) -> Any:
    if not _configured():
        return _not_configured(request)

    # Resolve the IdP routing hint: explicit connection/org wins, else derive
    # the domain from the email.
    domain: Optional[str] = None
    if email and "@" in email:
        domain = email.split("@", 1)[1].strip().lower()

    if not (connection or organization or domain):
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Missing Routing Hint",
                status=422,
                detail="Provide email, organization, or connection to route to the correct IdP.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    try:
        import workos  # noqa: PLC0415

        client = workos.WorkOSClient(api_key=WORKOS_API_KEY, client_id=WORKOS_CLIENT_ID)
        params: dict[str, Any] = {"redirect_uri": WORKOS_REDIRECT_URI}
        if connection:
            params["connection"] = connection
        elif organization:
            params["organization"] = organization
        elif domain:
            params["domain"] = domain

        authorization_url = client.sso.get_authorization_url(**params)
        logger.info("SSO authorization URL issued", extra={"domain": domain, "org": organization})
        return {"authorization_url": authorization_url}
    except ImportError:
        logger.error("workos package not installed")
        return JSONResponse(
            status_code=503,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/sso-unavailable",
                title="SSO Unavailable",
                status=503,
                detail="The WorkOS SDK is not installed on the backend.",
                instance=str(request.url.path),
            ).model_dump(),
        )
    except Exception as exc:
        logger.exception("SSO authorize failed", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="SSO Error",
                status=500,
                detail="Failed to begin SSO authorization.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── GET /sso/callback ─────────────────────────────────────────────────────────

@router.get(
    "/sso/callback",
    summary="SSO callback (WorkOS redirect)",
    description="WorkOS redirects here after IdP authentication. Exchanges the code for a profile and resolves the tenant.",
)
async def sso_callback(
    request: Request,
    code: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    if not _configured():
        return _not_configured(request)
    if not code:
        return JSONResponse(
            status_code=422,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/validation",
                title="Missing Code",
                status=422,
                detail="The SSO callback is missing the authorization code.",
                instance=str(request.url.path),
            ).model_dump(),
        )

    try:
        import workos  # noqa: PLC0415

        client = workos.WorkOSClient(api_key=WORKOS_API_KEY, client_id=WORKOS_CLIENT_ID)
        profile_and_token = client.sso.get_profile_and_token(code)
        profile = profile_and_token.profile

        email = getattr(profile, "email", None)
        org_id = getattr(profile, "organization_id", None)
        logger.info(
            "SSO callback authenticated",
            extra={"email": email, "organization_id": org_id},
        )

        # TODO: map WorkOS organization_id → Tenant, ensure a TenantMembership
        # exists for this email, mint a session/JWT, and redirect with it.
        # For now, redirect to the tenant portal and let the existing Firebase
        # bridge resolve membership by email domain.
        from fastapi.responses import RedirectResponse  # noqa: PLC0415

        return RedirectResponse(url=SSO_SUCCESS_REDIRECT)
    except ImportError:
        return JSONResponse(
            status_code=503,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/sso-unavailable",
                title="SSO Unavailable",
                status=503,
                detail="The WorkOS SDK is not installed on the backend.",
                instance=str(request.url.path),
            ).model_dump(),
        )
    except Exception as exc:
        logger.exception("SSO callback failed", extra={"error": str(exc)})
        return JSONResponse(
            status_code=500,
            content=ProblemDetail(
                type="https://agenthive.ai/errors/internal",
                title="SSO Error",
                status=500,
                detail="SSO authentication failed.",
                instance=str(request.url.path),
            ).model_dump(),
        )


# ── POST /sso/scim/webhook ────────────────────────────────────────────────────

@router.post(
    "/sso/scim/webhook",
    summary="SCIM / Directory Sync webhook",
    description=(
        "Receives WorkOS Directory Sync events (user.created / updated / deleted) "
        "to provision and deprovision tenant memberships automatically."
    ),
)
async def scim_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> Any:
    if not _configured():
        return _not_configured(request)

    # TODO: verify the WorkOS webhook signature (WORKOS_WEBHOOK_SECRET) before
    # processing, then handle directory events:
    #   dsync.user.created  → create TenantMembership (role from IdP group mapping)
    #   dsync.user.deleted  → revoke TenantMembership
    payload = await request.json()
    event = payload.get("event", "unknown")
    logger.info("SCIM webhook received", extra={"event": event})
    return {"received": True, "event": event}
