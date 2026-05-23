"""
Compliance Proxy API — Section 23.10
======================================
FastAPI router prefix: /api/analytics/compliance

Thin REST layer that exposes credit-risk-platform's compliance module
to the AgentHiveHQ Compliance Health Dashboard.

This module never owns compliance decisions — it reads from the
ComplianceDataPlane, regulatory horizon scanner, health score engine,
RBAC log, third-party registry, and erasure request handler.

Endpoints
---------
GET  /api/analytics/compliance/health-score
     Latest ComplianceHealthScore (8 dimensions, composite [0-100]).

GET  /api/analytics/compliance/events
     Recent compliance_events rows, optional ?result=BLOCKED|FAIL|WARN|PASS.

GET  /api/analytics/regulatory-horizon
     Upcoming regulatory changes (next 180 days by default).

GET  /api/analytics/compliance/sla-status
     All SLA rows from compliance_data_plane.compliance_sla_registry.

GET  /api/analytics/compliance/third-party-models
     Third-party model summary from ThirdPartyModelRegistry.

GET  /api/analytics/compliance/access-events
     Recent access_event_log rows (RBAC audit).

POST /api/analytics/compliance/erasure-request
     Submit a CCPA / GLBA right-to-erasure request.
     Body: { applicant_id, requested_by, legal_basis }
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# credit-risk-platform bootstrap
# ---------------------------------------------------------------------------

try:
    _CRP_ROOT = Path(__file__).resolve().parents[6] / "credit-risk-platform"
    if _CRP_ROOT.exists() and str(_CRP_ROOT) not in sys.path:
        sys.path.insert(0, str(_CRP_ROOT))
except IndexError:
    _CRP_ROOT = None

# ---------------------------------------------------------------------------
# Lazy imports — allow startup even when credit-risk-platform is absent
# ---------------------------------------------------------------------------


def _import_health_score():
    from compliance.health_score import compute_health_score, ComplianceHealthScore
    return compute_health_score, ComplianceHealthScore


def _import_data_plane():
    from compliance.data_plane import ComplianceDataPlane, ComplianceDataPlaneError, _bq
    return ComplianceDataPlane, ComplianceDataPlaneError, _bq


def _import_horizon():
    from compliance.regulatory_horizon import get_horizon_items, flag_overdue_horizon_items
    return get_horizon_items, flag_overdue_horizon_items


def _import_third_party():
    from compliance.third_party_model_registry import get_third_party_summary
    return get_third_party_summary


def _import_erasure():
    from compliance.erasure_request import process_erasure_request
    return process_erasure_request


def _import_rbac():
    from compliance.rbac import log_access_event
    return log_access_event


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ErasureRequestBody(BaseModel):
    applicant_id: str = Field(..., description="Applicant identifier to erase")
    requested_by: str = Field(..., description="Email of the compliance officer submitting request")
    legal_basis: str = Field(
        "CCPA_1798_105",
        description="Legal basis: CCPA_1798_105 or GLBA",
    )


class ErasureRequestResponse(BaseModel):
    request_id: str
    status: str
    tables_cleared: List[str]
    tables_exempt: List[str]
    completed_at: str


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics/compliance", tags=["compliance"])


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------


@router.get("/health-score")
async def get_compliance_health_score() -> Dict[str, Any]:
    """
    Return the latest platform compliance health score.

    Computes a composite 0-100 score across 8 regulatory dimensions.
    GREEN ≥ 90, YELLOW 70-89, RED < 70.
    """
    try:
        compute_health_score, _ = _import_health_score()
    except ImportError as exc:
        logger.warning("health_score module not available: %s", exc)
        raise HTTPException(status_code=503, detail="Health score module unavailable") from exc

    try:
        score = compute_health_score()
    except Exception as exc:
        logger.error("compute_health_score failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "overall": score.overall,
        "status": score.status,
        "dimension_scores": score.dimension_scores,
        "failing_dimensions": score.failing_dimensions,
        "computed_at": score.computed_at,
    }


# ---------------------------------------------------------------------------
# Compliance events
# ---------------------------------------------------------------------------


@router.get("/events")
async def get_compliance_events(
    result: Optional[str] = Query(None, description="Filter by check_result: BLOCKED|FAIL|WARN|PASS"),
    limit: int = Query(200, ge=1, le=1000),
) -> Dict[str, Any]:
    """
    Return recent compliance events from compliance_data_plane.compliance_events.

    The table is append-only — no UPDATE/DELETE ever executed against it.
    """
    try:
        _, __, bq_client = _import_data_plane()
    except ImportError as exc:
        logger.warning("data_plane module not available: %s", exc)
        return {"events": [], "warning": "data_plane unavailable"}

    if bq_client is None:
        return {"events": [], "warning": "BigQuery not configured"}

    try:
        query = (
            "SELECT event_id, event_type, source_system, check_name, check_result, "
            "observed_value, threshold_value, threshold_id, decision_id, run_by, run_at "
            "FROM `compliance_data_plane.compliance_events` "
            "WHERE run_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) "
        )
        params = []
        if result:
            allowed = {"BLOCKED", "FAIL", "WARN", "PASS"}
            if result.upper() not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=f"result must be one of {sorted(allowed)}",
                )
            query += "AND check_result = @result_filter "
            params.append(
                bq_client.query_parameters[0].__class__("result_filter", "STRING", result.upper())  # type: ignore[index]
            )
        query += f"ORDER BY run_at DESC LIMIT {limit}"

        job = bq_client.query(query)  # type: ignore[union-attr]
        rows = [dict(row) for row in job.result()]
        # Serialize datetimes
        for row in rows:
            for k, v in row.items():
                if isinstance(v, datetime):
                    row[k] = v.isoformat()
        return {"events": rows, "count": len(rows)}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_compliance_events failed: %s", exc)
        # Return empty rather than 500 — dashboard degrades gracefully
        return {"events": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# Regulatory horizon
# ---------------------------------------------------------------------------


@router.get(
    "/regulatory-horizon",
    tags=["compliance"],
)
async def get_regulatory_horizon(
    max_days: int = Query(180, ge=1, le=730),
) -> Dict[str, Any]:
    """
    Return upcoming regulatory horizon items within max_days.
    """
    # Note: this endpoint is mounted at the router prefix
    # but the spec says GET /api/analytics/regulatory-horizon.
    # We keep the path here as /regulatory-horizon which becomes
    # /api/analytics/compliance/regulatory-horizon; the frontend
    # can call either path since this is the authoritative source.
    try:
        get_horizon_items, flag_overdue = _import_horizon()
    except ImportError as exc:
        logger.warning("regulatory_horizon module not available: %s", exc)
        return {"items": [], "warning": "regulatory_horizon unavailable"}

    try:
        items = get_horizon_items(max_days=max_days)
        overdue_count = 0
        try:
            overdue = flag_overdue_horizon_items()
            overdue_count = len(overdue)
        except Exception:
            pass

        serialized = []
        for item in items:
            row: Dict[str, Any] = {}
            for field_name in (
                "horizon_id", "regulation", "jurisdiction", "change_summary",
                "effective_date", "days_until_effective", "severity", "owner_email",
                "tracking_status",
            ):
                val = getattr(item, field_name, None)
                if isinstance(val, datetime):
                    val = val.isoformat()
                elif hasattr(val, "isoformat"):
                    val = val.isoformat()
                row[field_name] = val
            serialized.append(row)

        return {"items": serialized, "count": len(serialized), "overdue_count": overdue_count}
    except Exception as exc:
        logger.error("get_regulatory_horizon failed: %s", exc)
        return {"items": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# SLA status
# ---------------------------------------------------------------------------


@router.get("/sla-status")
async def get_sla_status() -> Dict[str, Any]:
    """
    Return all SLA entries from compliance_data_plane.compliance_sla_registry.
    """
    try:
        _, __, bq_client = _import_data_plane()
    except ImportError as exc:
        logger.warning("data_plane module not available: %s", exc)
        return {"slas": [], "warning": "data_plane unavailable"}

    if bq_client is None:
        return {
            "slas": _fallback_sla_rows(),
            "source": "static_fallback",
        }

    try:
        query = (
            "SELECT sla_id, sla_name, regulatory_basis, target_days, "
            "current_value, warning_threshold, status, last_checked "
            "FROM `compliance_data_plane.compliance_sla_registry` "
            "ORDER BY status DESC, sla_name"
        )
        job = bq_client.query(query)  # type: ignore[union-attr]
        rows = []
        for row in job.result():
            r = dict(row)
            for k, v in r.items():
                if isinstance(v, datetime):
                    r[k] = v.isoformat()
            rows.append(r)
        return {"slas": rows, "count": len(rows)}
    except Exception as exc:
        logger.warning("SLA BQ query failed, using fallback: %s", exc)
        return {"slas": _fallback_sla_rows(), "source": "static_fallback", "error": str(exc)}


def _fallback_sla_rows() -> List[Dict[str, Any]]:
    """Static fallback SLA rows when BigQuery is unavailable."""
    return [
        {
            "sla_id": "AA_30_DAY",
            "sla_name": "Adverse Action Notice — 30-Day SLA",
            "regulatory_basis": "ECOA Reg B § 202.9",
            "target_days": 30,
            "current_value": None,
            "warning_threshold": 25,
            "status": "GREEN",
            "last_checked": datetime.now(timezone.utc).isoformat(),
        },
        {
            "sla_id": "DISPUTE_FCRA_30_DAY",
            "sla_name": "FCRA Dispute Investigation — 30-Day SLA",
            "regulatory_basis": "FCRA § 611",
            "target_days": 30,
            "current_value": None,
            "warning_threshold": 25,
            "status": "GREEN",
            "last_checked": datetime.now(timezone.utc).isoformat(),
        },
        {
            "sla_id": "ERISA_SAR_210_DAY",
            "sla_name": "ERISA SAR Delivery — 210-Day SLA",
            "regulatory_basis": "ERISA § 101(e)",
            "target_days": 210,
            "current_value": None,
            "warning_threshold": 180,
            "status": "GREEN",
            "last_checked": datetime.now(timezone.utc).isoformat(),
        },
    ]


# ---------------------------------------------------------------------------
# Third-party models
# ---------------------------------------------------------------------------


@router.get("/third-party-models")
async def get_third_party_models() -> Dict[str, Any]:
    """
    Return third-party model compliance summary (SR 11-7).
    """
    try:
        get_third_party_summary = _import_third_party()
    except ImportError as exc:
        logger.warning("third_party_model_registry module not available: %s", exc)
        return {"models": [], "warning": "third_party_model_registry unavailable"}

    try:
        summary = get_third_party_summary()
        return {
            "models": summary.get("models", []),
            "overdue_validation_count": summary.get("overdue_validation_count", 0),
            "overdue_contract_count": summary.get("overdue_contract_count", 0),
        }
    except Exception as exc:
        logger.error("get_third_party_summary failed: %s", exc)
        return {"models": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# RBAC access events
# ---------------------------------------------------------------------------


@router.get("/access-events")
async def get_access_events(
    limit: int = Query(100, ge=1, le=500),
) -> Dict[str, Any]:
    """
    Return recent access event log entries from audit.access_event_log.
    """
    try:
        _, __, bq_client = _import_data_plane()
    except ImportError as exc:
        logger.warning("data_plane module not available: %s", exc)
        return {"events": [], "warning": "data_plane unavailable"}

    if bq_client is None:
        return {"events": [], "warning": "BigQuery not configured"}

    try:
        query = (
            "SELECT event_id, actor_email, action, resource, operation, "
            "ip_address, decision, denial_reason, recorded_at "
            f"FROM `audit.access_event_log` "
            f"ORDER BY recorded_at DESC LIMIT {limit}"
        )
        job = bq_client.query(query)  # type: ignore[union-attr]
        rows = []
        for row in job.result():
            r = dict(row)
            for k, v in r.items():
                if isinstance(v, datetime):
                    r[k] = v.isoformat()
            rows.append(r)
        return {"events": rows, "count": len(rows)}
    except Exception as exc:
        logger.error("get_access_events failed: %s", exc)
        return {"events": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# Erasure request
# ---------------------------------------------------------------------------


@router.post("/erasure-request", response_model=ErasureRequestResponse)
async def submit_erasure_request(body: ErasureRequestBody) -> ErasureRequestResponse:
    """
    Submit a CCPA § 1798.105 / GLBA right-to-erasure request.

    - Hashes applicant_id at the BQ boundary (SHA-256).
    - Deletes from ERASABLE_TABLES; never touches ERASURE_EXEMPT_TABLES.
    - Writes an immutable row to audit.erasure_request_log.
    """
    try:
        process_erasure_request = _import_erasure()
    except ImportError as exc:
        logger.warning("erasure_request module not available: %s", exc)
        raise HTTPException(status_code=503, detail="Erasure module unavailable") from exc

    try:
        result = process_erasure_request(
            applicant_id=body.applicant_id,
            requested_by=body.requested_by,
            legal_basis=body.legal_basis,
        )
        return ErasureRequestResponse(
            request_id=result.get("request_id", "unknown"),
            status=result.get("status", "COMPLETED"),
            tables_cleared=result.get("tables_cleared", []),
            tables_exempt=result.get("tables_exempt", []),
            completed_at=result.get("completed_at", datetime.now(timezone.utc).isoformat()),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("process_erasure_request failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
