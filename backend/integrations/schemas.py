"""Pydantic v2 schemas for the External AI Product Integration Gateway.

These are the canonical contracts used for:
  - Validating YAML manifests loaded from integrations/registry/
  - Structuring the /api/integrations/{product_id}/invoke POST body
  - Normalising every external product response before it reaches the frontend
  - Writing ExternalDecisionRecord rows (audit trail)

All models are strict where external data crosses the trust boundary.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator, model_validator


# ── Auth types ────────────────────────────────────────────────────────────────

class AuthType(str, Enum):
    NONE = "none"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    MTLS = "mtls"


# ── Health status ─────────────────────────────────────────────────────────────

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    UNKNOWN = "unknown"


# ── Demo scenario ─────────────────────────────────────────────────────────────

class DemoScenario(BaseModel):
    """A named pre-built demo scenario for an external product."""

    tag: str = Field(..., description="Machine key used in invoke scenario_tag")
    label: str = Field(..., description="Human-readable label shown in ScenarioSelector")
    description: str = Field(default="", description="One-line description for the UI")


# ── Product Manifest ──────────────────────────────────────────────────────────

class ProductManifest(BaseModel):
    """Canonical manifest for a registered external AI product.

    One YAML file per product in integrations/registry/.
    The manifest is the single source of truth for routing, auth,
    UI rendering, and compliance metadata.
    """

    # Identity
    product_id: str = Field(
        ...,
        pattern=r"^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$",
        description="URL-safe unique identifier, e.g. 'thinfile-applicant-v1'",
    )
    display_name: str = Field(..., max_length=80, description="Name shown in Lab product selector")
    description: str = Field(..., max_length=500, description="One-paragraph description for product card")
    category: str = Field(default="external", description="Category tag: credit | fraud | kyc | income | external")

    # Routing
    base_url: str = Field(..., description="HTTPS base URL of the external FastAPI service")
    health_check_path: str = Field(default="/health", description="Liveness endpoint path")
    invoke_path: str = Field(default="/invoke", description="Inference endpoint path")
    schema_path: str = Field(default="/openapi.json", description="OpenAPI schema endpoint path")

    # Auth
    auth_type: AuthType = Field(default=AuthType.API_KEY)
    auth_secret_env_var: Optional[str] = Field(
        default=None,
        description="Name of the env var containing the API key / client secret. Never stored in manifest.",
    )

    # Behaviour
    copilot_enabled: bool = Field(
        default=False,
        description="When true, CopilotNarrative wraps the output panel",
    )
    demo_mode_supported: bool = Field(default=True)
    demo_scenarios: list[DemoScenario] = Field(default_factory=list)

    # Compliance / governance
    pii_fields: list[str] = Field(
        default_factory=list,
        description="Field names in inputs{} that will be stripped before audit logging",
    )
    data_residency: str = Field(default="us-east-1", description="AWS region / cloud region of the service")

    # SLA
    timeout_seconds: int = Field(default=30, ge=1, le=120)
    rate_limit_rpm: int = Field(default=60, ge=1, le=6000)

    @field_validator("base_url")
    @classmethod
    def must_be_https_or_localhost(cls, v: str) -> str:
        if not (v.startswith("https://") or v.startswith("http://localhost") or v.startswith("http://127.0.0.1")):
            raise ValueError("base_url must use HTTPS (or localhost for development)")
        return v.rstrip("/")

    @property
    def invoke_url(self) -> str:
        return f"{self.base_url}{self.invoke_path}"

    @property
    def health_url(self) -> str:
        return f"{self.base_url}{self.health_check_path}"

    @property
    def schema_url(self) -> str:
        return f"{self.base_url}{self.schema_path}"


# ── Product listing (read model) ──────────────────────────────────────────────

class ProductSummary(BaseModel):
    """Lightweight product card returned by GET /api/integrations."""

    product_id: str
    display_name: str
    description: str
    category: str
    copilot_enabled: bool
    demo_mode_supported: bool
    demo_scenarios: list[DemoScenario]
    health_status: HealthStatus = HealthStatus.UNKNOWN
    last_health_check: Optional[str] = None  # ISO8601 UTC

    @classmethod
    def from_manifest(
        cls,
        manifest: ProductManifest,
        health_status: HealthStatus = HealthStatus.UNKNOWN,
        last_health_check: Optional[datetime] = None,
    ) -> "ProductSummary":
        return cls(
            product_id=manifest.product_id,
            display_name=manifest.display_name,
            description=manifest.description,
            category=manifest.category,
            copilot_enabled=manifest.copilot_enabled,
            demo_mode_supported=manifest.demo_mode_supported,
            demo_scenarios=manifest.demo_scenarios,
            health_status=health_status,
            last_health_check=last_health_check.isoformat() if last_health_check else None,
        )


# ── Invoke request / response ─────────────────────────────────────────────────

class InvokeRequest(BaseModel):
    """Body sent to POST /api/integrations/{product_id}/invoke."""

    inputs: dict[str, Any] = Field(
        ...,
        description="Arbitrary key-value applicant/transaction fields validated against the product schema",
    )
    demo_mode: bool = Field(default=False)
    scenario_tag: Optional[str] = Field(default=None, max_length=64)


class AuditBlock(BaseModel):
    """Mandatory audit metadata every external product must return."""

    model_config = {"protected_namespaces": ()}

    model_version: str = Field(default="unknown")
    timestamp: str = Field(default_factory=lambda: datetime.now(tz=timezone.utc).isoformat())
    latency_ms: float = Field(default=0.0, ge=0)


class NormalisedResponse(BaseModel):
    """Canonical response returned to the frontend for ANY external product.

    The proxy maps the upstream JSON into this shape.  Fields outside
    the contract are captured in `raw_extra` and surfaced in a
    collapsible raw JSON block in the UI.
    """

    decision_id: str = Field(default_factory=lambda: str(uuid4()))
    decision: str = Field(..., description="approve | reject | review | <custom>")
    summary: str = Field(..., description="Headline shown in OutputPanel")
    details: dict[str, Any] = Field(default_factory=dict)
    explanations: dict[str, Any] = Field(default_factory=dict)
    reason_codes: list[str] = Field(default_factory=list)
    audit: AuditBlock = Field(default_factory=AuditBlock)
    source: str = Field(default="external")
    product_id: str = Field(default="")
    raw_extra: dict[str, Any] = Field(
        default_factory=dict,
        description="Fields from the upstream payload not in the normalised contract",
    )

    @model_validator(mode="before")
    @classmethod
    def extract_raw_extra(cls, data: dict[str, Any]) -> dict[str, Any]:
        """Pull unknown fields into raw_extra rather than failing validation."""
        known = {
            "decision_id", "decision", "summary", "details",
            "explanations", "reason_codes", "audit", "source",
            "product_id", "raw_extra",
        }
        extra = {k: v for k, v in data.items() if k not in known}
        if extra:
            data.setdefault("raw_extra", {}).update(extra)
        return data


# ── Admin registration ────────────────────────────────────────────────────────

class RegisterProductRequest(BaseModel):
    """Body for POST /api/integrations (admin: register new product from inline manifest)."""

    manifest: ProductManifest


class DeregisterResponse(BaseModel):
    product_id: str
    message: str = "Product deregistered successfully"


# ── Problem detail (RFC 7807) ─────────────────────────────────────────────────

class IntegrationProblemDetail(BaseModel):
    type: str = "https://agenthive.ai/errors/integration"
    title: str
    status: int
    detail: str
    instance: str = ""
    product_id: Optional[str] = None
