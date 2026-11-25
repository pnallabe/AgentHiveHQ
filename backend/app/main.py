"""AgentHive FastAPI application factory.

Entry point for uvicorn:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

# Load .env into os.environ BEFORE any other imports so that os.getenv()
# calls in integrations/proxy.py (and elsewhere) see the values.
from dotenv import load_dotenv
load_dotenv()  # reads backend/.env (or cwd/.env)

import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.database import create_tables
from integrations import registry as integration_registry
from integrations.health_monitor import start_health_monitor, stop_health_monitor
from integrations.proxy import close_http_client
from integrations.cloudflare import close_cloudflare_client

# ── Logging ──────────────────────────────────────────────────────────────────
configure_logging(settings.APP_LOG_LEVEL)
logger = get_logger(__name__)


# ── Application factory ───────────────────────────────────────────────────────
def create_app() -> FastAPI:
    application = FastAPI(
        title="AgentHive Credit Decisioning API",
        description=(
            "Production-grade AI credit decisioning engine. "
            "All decisions are persisted with a full audit trail."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    origins = settings.allowed_origins_list
    logger.info("CORS allowed origins", extra={"allowed_origins": origins})
    if "*" in origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"https?://.*",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # ── Startup / shutdown ────────────────────────────────────────────────────
    @application.on_event("startup")
    async def _startup() -> None:
        logger.info("Starting AgentHive backend", extra={"env": settings.APP_ENV})
        await create_tables()
        logger.info("Database tables verified / created")
        # ── Integration gateway ─────────────────────────────────────────
        integration_registry.load_registry()
        start_health_monitor()
        logger.info("Integration gateway initialised")

    @application.on_event("shutdown")
    async def _shutdown() -> None:
        logger.info("Shutting down AgentHive backend")
        await stop_health_monitor()
        await close_http_client()
        await close_cloudflare_client()

    # ── Global RFC 7807 exception handler ────────────────────────────────────
    @application.exception_handler(Exception)
    async def _global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", extra={"path": str(request.url)})
        return JSONResponse(
            status_code=500,
            content={
                "type": "https://agenthive.ai/errors/internal",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "An unexpected error occurred. The incident has been logged.",
                "instance": str(request.url.path),
            },
        )

    # ── Health endpoint ───────────────────────────────────────────────────────
    @application.get("/api/health", tags=["Meta"])
    async def health() -> dict:
        return {
            "status": "ok",
            "env": settings.APP_ENV,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }

    # ── Module routers ────────────────────────────────────────────────────────
    from app.modules.underwriting.api import router as underwriting_router  # noqa: PLC0415
    from app.modules.copilot.api import router as copilot_router  # noqa: PLC0415
    from app.modules.governance.api import router as governance_router  # noqa: PLC0415
    from integrations.router import router as integrations_router  # noqa: PLC0415
    from app.modules.analytics.cc_valuation_api import router as cc_valuation_router  # noqa: PLC0415
    from app.modules.analytics.cc_portfolio_api import router as cc_portfolio_router  # noqa: PLC0415
    from app.modules.analytics.mrm_proxy_api import router as mrm_router  # noqa: PLC0415
    from app.modules.analytics.compliance_proxy_api import router as compliance_router  # noqa: PLC0415
    from app.modules.analytics.api import router as analytics_router  # noqa: PLC0415
    from app.modules.dns.router import router as dns_router  # noqa: PLC0415
    from app.modules.inquiries.api import router as inquiries_router  # noqa: PLC0415
    from app.modules.tenants.api import router as tenants_router  # noqa: PLC0415
    from app.modules.sso.api import router as sso_router  # noqa: PLC0415

    application.include_router(underwriting_router, prefix="/api/underwriting", tags=["Underwriting"])
    application.include_router(copilot_router, prefix="/api/copilot", tags=["Copilot"])
    application.include_router(governance_router, prefix="/api/governance", tags=["Governance"])
    application.include_router(integrations_router, prefix="/api/integrations", tags=["Integrations"])
    application.include_router(cc_valuation_router, prefix="/api/analytics/cc-valuation", tags=["Analytics — CC Valuation"])
    application.include_router(cc_portfolio_router, prefix="/api/analytics/cc-portfolio", tags=["Analytics — CC Portfolio"])
    application.include_router(mrm_router, prefix="/api/analytics/mrm", tags=["Analytics — MRM Registry"])
    application.include_router(compliance_router, tags=["Analytics — Compliance"])
    application.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics — Core"])
    application.include_router(dns_router)
    application.include_router(inquiries_router, prefix="/api/v1", tags=["Tenant Inquiries"])
    application.include_router(tenants_router, prefix="/api/v1", tags=["Tenants"])
    application.include_router(sso_router, prefix="/api/v1", tags=["SSO"])

    return application


app = create_app()
