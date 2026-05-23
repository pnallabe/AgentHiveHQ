"""FastAPI router for the External AI Product Integration Gateway.

Mounted at: /api/integrations
Wired in:   app/main.py

Endpoints
---------
GET    /api/integrations
    List all registered products with live health status.

GET    /api/integrations/{product_id}
    Get a single product summary + health.

GET    /api/integrations/{product_id}/schema
    Proxy-fetch the upstream OpenAPI schema (used by Lab UI to build input form).

POST   /api/integrations/{product_id}/invoke
    Secure proxy: validate → inject auth → forward → normalise → audit log → return.

POST   /api/integrations
    Admin: register a new product from an inline manifest payload.

DELETE /api/integrations/{product_id}
    Admin: deregister a product (optionally deletes YAML file).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_firebase_user
from app.core.logging import get_logger
from app.database import get_db
from app.shared.db_models import AuditLog, DecisionRecord
from integrations import registry as reg
from integrations.proxy import ProxyError, fetch_schema, proxy_invoke
from integrations.schemas import (
    DeregisterResponse,
    HealthStatus,
    IntegrationProblemDetail,
    InvokeRequest,
    NormalisedResponse,
    ProductSummary,
    RegisterProductRequest,
)

logger = get_logger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _not_found(product_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=IntegrationProblemDetail(
            type="https://agenthive.ai/errors/integration/not-found",
            title="Product Not Found",
            status=404,
            detail=f"No registered integration with product_id '{product_id}'.",
            product_id=product_id,
        ).model_dump(),
    )


def _proxy_error_response(exc: ProxyError, product_id: str, path: str) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content=IntegrationProblemDetail(
            type=f"https://agenthive.ai/errors/integration/{exc.status}",
            title=exc.title,
            status=exc.status,
            detail=exc.detail,
            instance=path,
            product_id=product_id,
        ).model_dump(),
    )


async def _write_audit_record(
    db: AsyncSession,
    decision_id: str,
    product_id: str,
    response: NormalisedResponse,
    audit_payload: dict[str, Any],
    demo_mode: bool,
) -> None:
    """Persist a DecisionRecord + AuditLog for every proxied call."""
    record = DecisionRecord(
        id=decision_id,
        applicant_ref=None,
        input_payload=audit_payload.get("inputs", {}),
        decision=response.decision,
        credit_limit=None,
        apr=None,
        confidence_score=None,
        risk_segment=product_id,   # re-use risk_segment column as product tag
        reason_codes=response.reason_codes,
        shap_values=response.explanations or None,
        model_version=response.audit.model_version,
        rules_triggered=[],
        demo_mode=demo_mode,
    )
    db.add(record)

    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        decision_id=decision_id,
        event_type="external_invoke",
        actor=f"integration:{product_id}",
        metadata_={
            "product_id": product_id,
            "latency_ms": audit_payload.get("latency_ms"),
            "scenario_tag": audit_payload.get("scenario_tag"),
            "source": "external",
        },
    )
    db.add(audit_log)
    await db.commit()


# ---------------------------------------------------------------------------
# GET /api/integrations
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[ProductSummary],
    summary="List all registered external AI products",
    description=(
        "Returns all products registered in the integration registry, "
        "including their live health status polled every 60 seconds."
    ),
)
async def list_integrations(
    _user: dict = Depends(require_firebase_user),
) -> list[ProductSummary]:
    return reg.get_all_summaries()


# ---------------------------------------------------------------------------
# GET /api/integrations/{product_id}
# ---------------------------------------------------------------------------

@router.get(
    "/{product_id}",
    response_model=ProductSummary,
    summary="Get a single registered product",
)
async def get_integration(
    product_id: str,
    _user: dict = Depends(require_firebase_user),
) -> ProductSummary | JSONResponse:
    manifest = reg.get_manifest(product_id)
    if not manifest:
        return _not_found(product_id)
    status_val, checked_at = reg.get_health(product_id)
    return ProductSummary.from_manifest(manifest, status_val, checked_at)


# ---------------------------------------------------------------------------
# GET /api/integrations/{product_id}/schema
# ---------------------------------------------------------------------------

@router.get(
    "/{product_id}/schema",
    summary="Proxy-fetch the upstream OpenAPI schema",
    description=(
        "Fetches and returns the OpenAPI JSON from the external product's /schema endpoint. "
        "Used by the Lab UI to auto-generate the input form."
    ),
)
async def get_product_schema(
    request: Request,
    product_id: str,
    _user: dict = Depends(require_firebase_user),
) -> JSONResponse:
    manifest = reg.get_manifest(product_id)
    if not manifest:
        return _not_found(product_id)

    try:
        schema = await fetch_schema(manifest)
        return JSONResponse(content=schema)
    except ProxyError as exc:
        return _proxy_error_response(exc, product_id, str(request.url.path))


# ---------------------------------------------------------------------------
# POST /api/integrations/{product_id}/invoke
# ---------------------------------------------------------------------------

@router.post(
    "/{product_id}/invoke",
    response_model=NormalisedResponse,
    summary="Invoke an external AI product (secure proxy)",
    description=(
        "Validates the request, injects platform auth headers, forwards to the "
        "external /invoke endpoint, normalises the response, writes an audit record, "
        "and returns the normalised decision."
    ),
)
async def invoke_integration(
    request: Request,
    product_id: str,
    payload: InvokeRequest,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_firebase_user),
) -> NormalisedResponse | JSONResponse:
    manifest = reg.get_manifest(product_id)
    if not manifest:
        return _not_found(product_id)

    # Check health — allow calls even if degraded, block only if configured
    health_status, _ = reg.get_health(product_id)
    if health_status == HealthStatus.DOWN:
        if payload.demo_mode and manifest.demo_mode_supported:
            logger.warning(
                "Product %s is DOWN; demo_mode=true so continuing with upstream call",
                product_id,
            )
        else:
            return JSONResponse(
                status_code=503,
                content=IntegrationProblemDetail(
                    type="https://agenthive.ai/errors/integration/unavailable",
                    title="Product Unavailable",
                    status=503,
                    detail=(
                        f"Product '{product_id}' is currently unreachable. "
                        "Try demo_mode=true for a pre-computed response."
                    ),
                    instance=str(request.url.path),
                    product_id=product_id,
                ).model_dump(),
            )

    try:
        normalised, audit_payload = await proxy_invoke(manifest, payload)
    except ProxyError as exc:
        return _proxy_error_response(exc, product_id, str(request.url.path))

    # Persist audit trail
    try:
        await _write_audit_record(
            db=db,
            decision_id=normalised.decision_id,
            product_id=product_id,
            response=normalised,
            audit_payload=audit_payload,
            demo_mode=payload.demo_mode,
        )
    except Exception as exc:
        # Audit write failure must not break the API response.
        # Rollback is required to reset the session to a clean state so that
        # get_db()'s post-yield commit does not raise InvalidRequestError.
        logger.error("Failed to write audit record for %s: %s", product_id, exc)
        await db.rollback()

    return normalised


# ---------------------------------------------------------------------------
# POST /api/integrations  (admin: register)
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=ProductSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Admin: Register a new external product",
    description=(
        "Validates the manifest, persists it as a YAML file in integrations/registry/, "
        "and adds it to the live registry immediately (no restart required)."
    ),
)
async def register_integration(
    request: Request,
    body: RegisterProductRequest,
) -> ProductSummary | JSONResponse:
    manifest = body.manifest

    if reg.get_manifest(manifest.product_id):
        return JSONResponse(
            status_code=409,
            content=IntegrationProblemDetail(
                type="https://agenthive.ai/errors/integration/conflict",
                title="Product Already Registered",
                status=409,
                detail=f"A product with product_id '{manifest.product_id}' is already registered. "
                       "Deregister it first or use a different product_id.",
                instance=str(request.url.path),
                product_id=manifest.product_id,
            ).model_dump(),
        )

    reg.register_product(manifest, persist=True)
    logger.info("Admin registered new product: %s", manifest.product_id)
    status_val, checked_at = reg.get_health(manifest.product_id)
    return ProductSummary.from_manifest(manifest, status_val, checked_at)


# ---------------------------------------------------------------------------
# DELETE /api/integrations/{product_id}  (admin: deregister)
# ---------------------------------------------------------------------------

@router.delete(
    "/{product_id}",
    response_model=DeregisterResponse,
    summary="Admin: Deregister an external product",
    description=(
        "Removes the product from the live registry and deletes its YAML manifest file. "
        "In-flight requests complete normally."
    ),
)
async def deregister_integration(
    request: Request,
    product_id: str,
    delete_file: bool = Query(default=True, description="Also delete the YAML manifest from disk"),
) -> DeregisterResponse | JSONResponse:
    removed = reg.deregister_product(product_id, delete_file=delete_file)
    if not removed:
        return _not_found(product_id)
    logger.info("Admin deregistered product: %s", product_id)
    return DeregisterResponse(product_id=product_id)
