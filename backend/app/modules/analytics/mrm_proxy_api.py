"""
MRM Proxy API — Section 21.5
=============================
FastAPI router prefix: /api/analytics/mrm

Thin REST layer that exposes credit-risk-platform's model registry,
audit framework, and MRM lifecycle data to the AgentHiveHQ dashboard.

This module never owns model artefacts or makes lifecycle decisions —
it reads from MLflow and the audit DB, and delegates mutations to
credit-risk-platform's ModelRegistry / audit.logger.

Endpoints
---------
GET  /api/analytics/mrm/models
     List all registered models with current stage, version, metrics, next_review_date.

GET  /api/analytics/mrm/models/{model_name}
     Full model detail — all versions, governance metrics, validation status,
     model card contents, champion/challenger config.

GET  /api/analytics/mrm/models/{model_name}/audit
     governance_approval_log entries for this model, paginated.

GET  /api/analytics/mrm/models/{model_name}/validations
     model_validation_log entries, latest first.

GET  /api/analytics/mrm/adverse-action/pending
     adverse_action_notice_queue PENDING records sorted by deadline ASC.

POST /api/analytics/mrm/models/{model_name}/promote
     Promote a model version to a new stage.
     Body: { version, stage, approved_by, notes }

POST /api/analytics/mrm/models/{model_name}/validations
     Record a model validation outcome.
     Body: { version, outcome, validator_email, conditions, findings, test_scripts_ref }
"""

from __future__ import annotations

import json
import logging
import os
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

def _import_registry():
    from mlflow_config.mlflow_config import (
        ModelRegistry,
        ALL_REGISTERED_MODELS,
        MODEL_GOVERNANCE,
        SR117_STAGES,
        MORTGAGE_VALUATION_MODEL_NAME,
    )
    return ModelRegistry, ALL_REGISTERED_MODELS, MODEL_GOVERNANCE, SR117_STAGES, MORTGAGE_VALUATION_MODEL_NAME


def _import_audit():
    from audit.logger import (
        log_governance_action,
        log_model_validation,
        get_governance_audit_log,
        get_model_validations,
        get_adverse_action_pending,
        get_adverse_action_overdue,
        check_validation_independence,
    )
    return (
        log_governance_action,
        log_model_validation,
        get_governance_audit_log,
        get_model_validations,
        get_adverse_action_pending,
        get_adverse_action_overdue,
        check_validation_independence,
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)
router = APIRouter()

MRM_DB_URL = os.getenv(
    "MRM_DB_URL",
    f"sqlite+aiosqlite:///{_CRP_ROOT / 'audit' / 'mrm_audit.db'}" if _CRP_ROOT else "sqlite+aiosqlite:///./mrm_audit.db",
)

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ModelVersionInfo(BaseModel):
    version: str
    stage: str
    run_id: Optional[str] = None
    status: Optional[str] = None
    sr11_7_stage: Optional[str] = None
    creation_timestamp: Optional[int] = None


class ModelSummary(BaseModel):
    model_name: str
    current_version: Optional[str] = None
    stage: str = "not_registered"
    review_cycle_months: int = 12
    next_review_date: Optional[str] = None
    last_promoted: Optional[str] = None
    sr11_7_stage: Optional[str] = None
    governance_status: str = "UNKNOWN"
    fair_lending_required: bool = True
    is_champion_challenger: bool = False


class ModelDetail(BaseModel):
    model_name: str
    versions: List[ModelVersionInfo]
    governance_thresholds: Dict[str, Any]
    current_production_metrics: Dict[str, Any] = {}
    model_card: Optional[Dict[str, Any]] = None
    champion_challenger_config: Optional[Dict[str, Any]] = None


class GovernanceAuditEntry(BaseModel):
    approval_id: str
    model_name: str
    model_version: str
    action: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    performed_by: str
    approved_by: Optional[str] = None
    performed_at: str
    governance_metrics: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    mlflow_run_id: Optional[str] = None


class ValidationEntry(BaseModel):
    validation_id: str
    model_name: str
    model_version: str
    validator_email: str
    validation_date: str
    validation_type: str
    outcome: str
    conditions: Optional[List[str]] = None
    findings: Optional[Dict[str, Any]] = None
    test_scripts_ref: Optional[str] = None
    approved_for_prod: bool
    notes: Optional[str] = None


class AdverseActionNotice(BaseModel):
    notice_id: str
    account_id: str
    action_type: str
    reason_codes: List[str]
    review_month: str
    model_version: str
    enqueued_at: str
    dispatch_deadline: str
    dispatched_at: Optional[str] = None
    dispatch_channel: Optional[str] = None
    dispatch_status: str
    overdue: bool = False


class PromoteRequest(BaseModel):
    version: str
    stage: str = Field(..., pattern="^(Staging|Production)$")
    approved_by: Optional[str] = None
    notes: str = ""


class ValidationRequest(BaseModel):
    version: str
    outcome: str = Field(..., pattern="^(PASS|PASS_WITH_CONDITIONS|FAIL)$")
    validator_email: str
    validation_type: str = Field(default="INITIAL", pattern="^(INITIAL|ANNUAL|TRIGGERED)$")
    conditions: Optional[List[str]] = None
    findings: Optional[Dict[str, Any]] = None
    test_scripts_ref: Optional[str] = None
    notes: str = ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_mlflow_client():
    from mlflow_config.mlflow_config import configure_mlflow
    from mlflow.tracking import MlflowClient

    configure_mlflow()
    return MlflowClient()


def _get_run_metrics(run_id: str) -> Dict[str, Any]:
    try:
        import mlflow

        run = mlflow.get_run(run_id)
        return dict(run.data.metrics)
    except Exception:
        return {}


def _load_model_card(model_name: str) -> Optional[Dict[str, Any]]:
    """Attempt to load model_card.json from known paths."""
    card_candidates = [
        _CRP_ROOT / "models" / "credit_risk" / f"{model_name.replace('/', '_')}_model_card.json",
        _CRP_ROOT / "models" / "credit_risk" / "portfolio_action_model_card.json",
        _CRP_ROOT / f"models/model_card.json",
    ]
    for path in card_candidates:
        if path.exists():
            try:
                return json.loads(path.read_text())
            except Exception:
                pass
    return None


def _compute_next_review_date(last_promoted_iso: Optional[str], review_cycle_months: int) -> Optional[str]:
    """Return ISO date string for next review, or None if last_promoted unknown."""
    if not last_promoted_iso:
        return None
    try:
        ts = last_promoted_iso.replace("Z", "+00:00")
        last = datetime.fromisoformat(ts)
        from datetime import timedelta

        next_review = last + timedelta(days=review_cycle_months * 30)
        return next_review.date().isoformat()
    except Exception:
        return None


def _governance_status(
    model_name: str,
    gov_thresholds: Dict[str, Any],
    current_metrics: Dict[str, Any],
) -> str:
    """Return PASS, WARN, or FAIL based on current metrics vs governance thresholds."""
    if not current_metrics:
        return "NO_METRICS"
    failures = []
    for key, threshold in gov_thresholds.items():
        if not isinstance(threshold, (int, float)):
            continue
        metric_prefix = key.replace("min_", "").replace("max_", "")
        # Find metric by rough key match
        matched = {k: v for k, v in current_metrics.items()
                   if metric_prefix in k.lower() or k.lower() in metric_prefix}
        if not matched:
            continue
        val = list(matched.values())[0]
        if key.startswith("min_") and float(val) < threshold:
            failures.append(key)
        elif key.startswith("max_") and float(val) > threshold:
            failures.append(key)
    if not failures:
        return "PASS"
    return "WARN" if len(failures) <= 1 else "FAIL"


# ---------------------------------------------------------------------------
# GET /api/analytics/mrm/models
# ---------------------------------------------------------------------------


@router.get("/models", response_model=List[ModelSummary], tags=["MRM"])
async def list_models() -> List[ModelSummary]:
    """List all registered models with current stage, version, and review schedule.

    Auth: executive role required (enforced by Firebase middleware in production).
    """
    try:
        _, ALL_REGISTERED_MODELS, MODEL_GOVERNANCE, _, _ = _import_registry()
        client = _get_mlflow_client()
    except Exception as exc:
        logger.error("MLflow unavailable: %s", exc)
        # Return governance config as stub when MLflow is unavailable
        _, ALL_REGISTERED_MODELS, MODEL_GOVERNANCE, _, _ = _import_registry()
        return [
            ModelSummary(
                model_name=m,
                governance_status="UNKNOWN",
                review_cycle_months=MODEL_GOVERNANCE.get(m, {}).get("review_cycle_months", 12),
                fair_lending_required=MODEL_GOVERNANCE.get(m, {}).get("fair_lending_required", True),
            )
            for m in ALL_REGISTERED_MODELS
        ]

    results: List[ModelSummary] = []
    for model_name in ALL_REGISTERED_MODELS:
        gov = MODEL_GOVERNANCE.get(model_name, {})
        review_cycle = int(gov.get("review_cycle_months", 12))

        try:
            versions = client.get_latest_versions(model_name, stages=["Production"])
            if versions:
                mv = versions[0]
                metrics = _get_run_metrics(mv.run_id) if mv.run_id else {}
                tags = mv.tags or {}
                last_promoted_ts = mv.last_updated_timestamp
                last_promoted_iso = (
                    datetime.fromtimestamp(last_promoted_ts / 1000, tz=timezone.utc).isoformat()
                    if last_promoted_ts else None
                )
                next_review = _compute_next_review_date(last_promoted_iso, review_cycle)
                gov_status = _governance_status(model_name, gov, metrics)
                results.append(ModelSummary(
                    model_name=model_name,
                    current_version=str(mv.version),
                    stage="Production",
                    review_cycle_months=review_cycle,
                    last_promoted=last_promoted_iso[:10] if last_promoted_iso else None,
                    next_review_date=next_review,
                    sr11_7_stage=tags.get("sr11_7_stage", "production"),
                    governance_status=gov_status,
                    fair_lending_required=bool(gov.get("fair_lending_required", True)),
                ))
            else:
                # No Production version yet — check Staging
                staging = client.get_latest_versions(model_name, stages=["Staging"])
                stage = "Staging" if staging else "not_registered"
                results.append(ModelSummary(
                    model_name=model_name,
                    current_version=str(staging[0].version) if staging else None,
                    stage=stage,
                    review_cycle_months=review_cycle,
                    governance_status="PENDING_VALIDATION",
                    fair_lending_required=bool(gov.get("fair_lending_required", True)),
                ))
        except Exception as exc:
            logger.warning("Could not fetch MLflow data for %s: %s", model_name, exc)
            results.append(ModelSummary(
                model_name=model_name,
                stage="error",
                review_cycle_months=review_cycle,
                governance_status="ERROR",
                fair_lending_required=bool(gov.get("fair_lending_required", True)),
            ))

    return results


# ---------------------------------------------------------------------------
# GET /api/analytics/mrm/models/{model_name}
# ---------------------------------------------------------------------------


@router.get("/models/{model_name}", response_model=ModelDetail, tags=["MRM"])
async def get_model_detail(model_name: str) -> ModelDetail:
    """Full model detail — all versions, governance metrics, validation status, model card.

    Auth: executive role required.
    """
    _, ALL_REGISTERED_MODELS, MODEL_GOVERNANCE, _, _ = _import_registry()

    if model_name not in ALL_REGISTERED_MODELS:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not found in registered model registry. "
                   f"Valid models: {ALL_REGISTERED_MODELS}",
        )

    gov = MODEL_GOVERNANCE.get(model_name, {})
    versions_info: List[ModelVersionInfo] = []
    current_production_metrics: Dict[str, Any] = {}

    try:
        client = _get_mlflow_client()
        all_versions = client.search_model_versions(f"name='{model_name}'")
        for mv in all_versions:
            tags = mv.tags or {}
            versions_info.append(ModelVersionInfo(
                version=str(mv.version),
                stage=mv.current_stage,
                run_id=mv.run_id,
                status=mv.status,
                sr11_7_stage=tags.get("sr11_7_stage"),
                creation_timestamp=mv.creation_timestamp,
            ))
            if mv.current_stage == "Production" and mv.run_id:
                current_production_metrics = _get_run_metrics(mv.run_id)
    except Exception as exc:
        logger.warning("MLflow unavailable for %s: %s", model_name, exc)

    model_card = _load_model_card(model_name)

    # Champion/challenger config (read from env/config for display purposes)
    champ_chall = {
        "champion_model": f"{model_name}/Production",
        "challenger_model": f"{model_name}/Staging",
        "note": "Configure challenger_traffic_pct in agent_config.yaml",
    }

    return ModelDetail(
        model_name=model_name,
        versions=versions_info,
        governance_thresholds=gov,
        current_production_metrics=current_production_metrics,
        model_card=model_card,
        champion_challenger_config=champ_chall,
    )


# ---------------------------------------------------------------------------
# GET /api/analytics/mrm/models/{model_name}/audit
# ---------------------------------------------------------------------------


@router.get("/models/{model_name}/audit", tags=["MRM"])
async def get_model_audit(
    model_name: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    """Governance audit log for *model_name*, paginated, newest first.

    Auth: executive role required.
    """
    (
        _,
        log_model_validation,
        get_governance_audit_log,
        *_rest,
    ) = _import_audit()

    try:
        return await get_governance_audit_log(model_name, MRM_DB_URL, limit=limit, offset=offset)
    except Exception as exc:
        logger.error("Could not fetch governance audit log for %s: %s", model_name, exc)
        raise HTTPException(status_code=500, detail=f"Audit log unavailable: {exc}")


# ---------------------------------------------------------------------------
# GET /api/analytics/mrm/models/{model_name}/validations
# ---------------------------------------------------------------------------


@router.get("/models/{model_name}/validations", tags=["MRM"])
async def get_model_validations_endpoint(model_name: str) -> List[Dict[str, Any]]:
    """model_validation_log entries for *model_name*, newest first.

    Auth: executive role required.
    """
    (
        _,
        _log_mv,
        _gov_log,
        get_model_validations,
        *_rest,
    ) = _import_audit()

    try:
        return await get_model_validations(model_name, MRM_DB_URL)
    except Exception as exc:
        logger.error("Could not fetch validations for %s: %s", model_name, exc)
        raise HTTPException(status_code=500, detail=f"Validation log unavailable: {exc}")


# ---------------------------------------------------------------------------
# GET /api/analytics/mrm/adverse-action/pending
# ---------------------------------------------------------------------------


@router.get("/adverse-action/pending", tags=["MRM"])
async def get_adverse_action_pending_endpoint() -> List[Dict[str, Any]]:
    """adverse_action_notice_queue PENDING records sorted by dispatch_deadline ASC.

    Overdue records (deadline < now) appear first and have overdue=True.
    Auth: executive role required.
    """
    (
        _,
        _,
        _,
        _,
        get_adverse_action_pending,
        *_rest,
    ) = _import_audit()

    try:
        return await get_adverse_action_pending(MRM_DB_URL)
    except Exception as exc:
        logger.error("Could not fetch adverse action queue: %s", exc)
        raise HTTPException(status_code=500, detail=f"Adverse action queue unavailable: {exc}")


# ---------------------------------------------------------------------------
# POST /api/analytics/mrm/models/{model_name}/promote
# ---------------------------------------------------------------------------


@router.post("/models/{model_name}/promote", tags=["MRM"])
async def promote_model_endpoint(
    model_name: str,
    body: PromoteRequest,
) -> Dict[str, Any]:
    """Promote model version to Staging or Production with governance checks.

    Writes a governance_approval_log record.
    Auth: executive role required.  Rate limit: 5 calls/hour (configured at gateway).
    """
    _, ALL_REGISTERED_MODELS, MODEL_GOVERNANCE, _, _ = _import_registry()

    if model_name not in ALL_REGISTERED_MODELS:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not in registry.",
        )

    if body.stage == "Production" and not body.approved_by:
        raise HTTPException(
            status_code=422,
            detail="approved_by is required for Production promotion (SR 11-7 two-approver rule).",
        )

    from audit.logger import log_governance_action, get_model_validations

    # Require passing validation before Production
    if body.stage == "Production":
        validations = await get_model_validations(model_name, MRM_DB_URL)
        valid = [
            v for v in validations
            if str(v.get("model_version")) == str(body.version)
            and v.get("outcome") in ("PASS", "PASS_WITH_CONDITIONS")
            and v.get("approved_for_prod")
        ]
        if not valid:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"No passing validation record for {model_name} v{body.version}. "
                    "SR 11-7 requires independent validation before Production promotion."
                ),
            )

    from mlflow_config.mlflow_config import ModelRegistry

    registry = ModelRegistry()
    try:
        registry.promote_model(model_name, body.version, body.stage)
    except Exception as exc:
        logger.error("Governance check failed for %s v%s: %s", model_name, body.version, exc)
        raise HTTPException(
            status_code=422,
            detail=f"Governance check failed: {exc}",
        )

    # Get run_id for audit record
    client = _get_mlflow_client()
    mv = client.get_model_version(model_name, body.version)
    metrics = _get_run_metrics(mv.run_id) if mv.run_id else {}

    approval_id = await log_governance_action(
        model_name=model_name,
        model_version=body.version,
        action=f"PROMOTE_{body.stage.upper()}",
        from_stage=mv.current_stage,
        to_stage=body.stage,
        performed_by=body.approved_by or "api-user",
        approved_by=body.approved_by,
        governance_metrics=metrics,
        notes=body.notes or f"Promoted to {body.stage} via MRM dashboard API",
        mlflow_run_id=mv.run_id,
        db_url=MRM_DB_URL,
    )

    return {
        "success": True,
        "model_name": model_name,
        "version": body.version,
        "stage": body.stage,
        "approval_id": approval_id,
        "message": f"Successfully promoted {model_name} v{body.version} → {body.stage}",
    }


# ---------------------------------------------------------------------------
# POST /api/analytics/mrm/models/{model_name}/validations
# ---------------------------------------------------------------------------


@router.post("/models/{model_name}/validations", tags=["MRM"])
async def record_validation_endpoint(
    model_name: str,
    body: ValidationRequest,
) -> Dict[str, Any]:
    """Record a model validation outcome.

    Validates independence: validator_email must differ from model developer email.
    Auth: executive role required.
    """
    _, ALL_REGISTERED_MODELS, *_ = _import_registry()

    if model_name not in ALL_REGISTERED_MODELS:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not in registry.")

    from audit.logger import log_model_validation, check_validation_independence

    # SR 11-7 independence check
    is_independent = await check_validation_independence(
        model_name, body.version, body.validator_email, MRM_DB_URL
    )
    if not is_independent:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Independence violation: validator_email '{body.validator_email}' "
                "matches model developer email. SR 11-7 requires independent validation."
            ),
        )

    approved_for_prod = body.outcome in ("PASS", "PASS_WITH_CONDITIONS")

    validation_id = await log_model_validation(
        model_name=model_name,
        model_version=body.version,
        validator_email=body.validator_email,
        validation_type=body.validation_type,
        outcome=body.outcome,
        conditions=body.conditions,
        findings=body.findings,
        test_scripts_ref=body.test_scripts_ref,
        approved_for_prod=approved_for_prod,
        notes=body.notes,
        db_url=MRM_DB_URL,
    )

    # Tag the MLflow model version
    try:
        client = _get_mlflow_client()
        client.set_model_version_tag(model_name, body.version, "validation_outcome", body.outcome)
        client.set_model_version_tag(model_name, body.version, "validator", body.validator_email)
    except Exception as exc:
        logger.warning("Could not update MLflow tags for %s v%s: %s", model_name, body.version, exc)

    return {
        "success": True,
        "validation_id": validation_id,
        "model_name": model_name,
        "version": body.version,
        "outcome": body.outcome,
        "approved_for_prod": approved_for_prod,
    }
