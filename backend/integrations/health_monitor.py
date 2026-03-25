"""Background health monitor for external integration products.

Polls each registered product's /health endpoint every POLL_INTERVAL_SECONDS.
Transitions between healthy / degraded / down states and emits log events
(and stub alerts) on any `down` transition.

Lifecycle
---------
`start_health_monitor()` is called during FastAPI startup.
`stop_health_monitor()` is called during FastAPI shutdown.

The monitor runs as a single asyncio.Task on the default event loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from integrations import registry as reg
from integrations.proxy import probe_health
from integrations.schemas import HealthStatus

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS: int = 60  # configurable — reads from env below
CONSECUTIVE_FAILURES_FOR_DOWN: int = 2


# ---------------------------------------------------------------------------
# State tracking (per product)
# ---------------------------------------------------------------------------

_consecutive_failures: dict[str, int] = {}
_monitor_task: Optional[asyncio.Task] = None  # type: ignore[type-arg]


# ---------------------------------------------------------------------------
# Alert stub (extend to Slack / email in production)
# ---------------------------------------------------------------------------

async def _alert_down(product_id: str, display_name: str) -> None:
    """Fire an alert when a product transitions to DOWN.

    In production wire this to:
      - Slack:  POST to SLACK_WEBHOOK_URL env var
      - Email:  send via SendGrid / SES
      - PagerDuty: POST to Events API v2
    """
    logger.critical(
        "[INTEGRATION ALERT] Product '%s' (%s) is DOWN — health check failed %d times consecutively.",
        product_id,
        display_name,
        CONSECUTIVE_FAILURES_FOR_DOWN,
    )
    # TODO: implement actual notification (Slack / SES webhook)


# ---------------------------------------------------------------------------
# Poll loop
# ---------------------------------------------------------------------------

async def _poll_once() -> None:
    """Poll all registered products' /health endpoints once."""
    manifests = reg.get_all_manifests()
    if not manifests:
        return

    tasks = {manifest.product_id: probe_health(manifest) for manifest in manifests}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for manifest, result in zip(manifests, results):
        pid = manifest.product_id
        is_healthy = result is True and not isinstance(result, Exception)

        if is_healthy:
            _consecutive_failures[pid] = 0
            prev_status, _ = reg.get_health(pid)
            if prev_status == HealthStatus.DOWN:
                logger.warning("Product '%s' recovered — status: healthy", pid)
            reg.set_health(pid, HealthStatus.HEALTHY)
        else:
            fails = _consecutive_failures.get(pid, 0) + 1
            _consecutive_failures[pid] = fails

            if fails >= CONSECUTIVE_FAILURES_FOR_DOWN:
                prev_status, _ = reg.get_health(pid)
                reg.set_health(pid, HealthStatus.DOWN)
                if prev_status != HealthStatus.DOWN:
                    await _alert_down(pid, manifest.display_name)
            else:
                reg.set_health(pid, HealthStatus.DEGRADED)
                logger.warning(
                    "Product '%s' health check failed (attempt %d/%d)",
                    pid,
                    fails,
                    CONSECUTIVE_FAILURES_FOR_DOWN,
                )


async def _monitor_loop() -> None:
    """Main loop — polls every POLL_INTERVAL_SECONDS indefinitely."""
    logger.info(
        "Integration health monitor started (interval: %ds, products: %d)",
        POLL_INTERVAL_SECONDS,
        len(reg.get_all_manifests()),
    )
    # Initial poll immediately on startup
    await _poll_once()

    while True:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        try:
            await _poll_once()
        except asyncio.CancelledError:
            logger.info("Integration health monitor cancelled")
            return
        except Exception as exc:
            # Never let a polling error crash the monitor loop
            logger.exception("Unexpected error in health monitor poll: %s", exc)


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def start_health_monitor() -> None:
    """Schedule the health monitor loop on the current event loop.

    Call from FastAPI @app.on_event("startup").
    """
    global _monitor_task
    loop = asyncio.get_event_loop()
    _monitor_task = loop.create_task(_monitor_loop(), name="integration-health-monitor")
    logger.info("Integration health monitor task created")


async def stop_health_monitor() -> None:
    """Cancel the health monitor loop gracefully.

    Call from FastAPI @app.on_event("shutdown").
    """
    global _monitor_task
    if _monitor_task and not _monitor_task.done():
        _monitor_task.cancel()
        try:
            await _monitor_task
        except asyncio.CancelledError:
            pass
        logger.info("Integration health monitor stopped")
