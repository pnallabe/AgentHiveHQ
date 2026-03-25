"""External product registry.

Loads all YAML manifests from integrations/registry/ on startup,
validates them with ProductManifest, and exposes a simple in-memory
registry dict for the rest of the gateway to consume.

Design decisions
----------------
- Registry is loaded once at startup; hot-reload not supported in prod.
- An invalid manifest (Pydantic validation error) fails loudly on startup
  so misconfigured products never silently disappear.
- Admin POST /api/integrations writes a new YAML file AND updates the
  in-memory registry atomically (file-write → dict-update).
- Thread/asyncio safety: all mutations hold a threading.Lock because the
  health monitor runs in a background asyncio.Task but Python dict access
  is GIL-protected; the lock is still used for correctness under any
  potential future thread-based deployment.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

import yaml  # pyyaml
from pydantic import ValidationError

from integrations.schemas import (
    HealthStatus,
    ProductManifest,
    ProductSummary,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REGISTRY_DIR = Path(__file__).parent / "registry"


# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

_lock = threading.Lock()

# product_id → ProductManifest
_manifests: Dict[str, ProductManifest] = {}

# product_id → (HealthStatus, last_checked_at)
_health: Dict[str, tuple[HealthStatus, Optional[datetime]]] = {}


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def load_registry() -> None:
    """Load (or reload) all manifests from REGISTRY_DIR.

    Called once during FastAPI startup.  Raises on the first invalid manifest
    so the service fails fast with a descriptive error rather than silently
    ignoring miscounted products.
    """
    REGISTRY_DIR.mkdir(parents=True, exist_ok=True)

    yaml_files = list(REGISTRY_DIR.glob("*.yaml")) + list(REGISTRY_DIR.glob("*.yml"))

    if not yaml_files:
        logger.warning("No integration manifests found in %s", REGISTRY_DIR)
        return

    loaded: Dict[str, ProductManifest] = {}

    for path in sorted(yaml_files):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise ValueError(f"YAML root must be a mapping, got {type(raw).__name__}")
            manifest = ProductManifest.model_validate(raw)
        except (ValidationError, ValueError, yaml.YAMLError) as exc:
            logger.error("Invalid manifest %s: %s", path.name, exc)
            raise RuntimeError(f"Integration gateway failed to load manifest '{path.name}': {exc}") from exc

        loaded[manifest.product_id] = manifest
        logger.info("Registered external product: %s (%s)", manifest.product_id, manifest.display_name)

    with _lock:
        _manifests.clear()
        _manifests.update(loaded)
        # Initialise health as UNKNOWN for new products
        for pid in loaded:
            if pid not in _health:
                _health[pid] = (HealthStatus.UNKNOWN, None)
        # Remove stale health entries for deregistered products
        for pid in list(_health.keys()):
            if pid not in loaded:
                del _health[pid]

    logger.info("Integration registry loaded: %d product(s)", len(loaded))


# ---------------------------------------------------------------------------
# Read accessors (safe to call from any coroutine/thread)
# ---------------------------------------------------------------------------

def get_all_manifests() -> list[ProductManifest]:
    with _lock:
        return list(_manifests.values())


def get_manifest(product_id: str) -> Optional[ProductManifest]:
    with _lock:
        return _manifests.get(product_id)


def get_all_summaries() -> list[ProductSummary]:
    with _lock:
        result = []
        for pid, manifest in _manifests.items():
            status, checked_at = _health.get(pid, (HealthStatus.UNKNOWN, None))
            result.append(ProductSummary.from_manifest(manifest, status, checked_at))
        return result


def get_health(product_id: str) -> tuple[HealthStatus, Optional[datetime]]:
    with _lock:
        return _health.get(product_id, (HealthStatus.UNKNOWN, None))


# ---------------------------------------------------------------------------
# Write accessors (used by health monitor & admin router)
# ---------------------------------------------------------------------------

def set_health(product_id: str, status: HealthStatus) -> None:
    with _lock:
        _health[product_id] = (status, datetime.now(tz=timezone.utc))


def register_product(manifest: ProductManifest, persist: bool = True) -> None:
    """Register a product at runtime (admin API).

    If persist=True, writes a new YAML file to REGISTRY_DIR so the product
    survives a server restart.
    """
    if persist:
        dest = REGISTRY_DIR / f"{manifest.product_id}.yaml"
        dest.write_text(
            yaml.dump(manifest.model_dump(mode="json"), sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )
        logger.info("Persisted manifest for %s to %s", manifest.product_id, dest)

    with _lock:
        _manifests[manifest.product_id] = manifest
        _health[manifest.product_id] = (HealthStatus.UNKNOWN, None)


def deregister_product(product_id: str, delete_file: bool = True) -> bool:
    """Remove a product from the registry.  Returns False if not found."""
    with _lock:
        if product_id not in _manifests:
            return False
        del _manifests[product_id]
        _health.pop(product_id, None)

    if delete_file:
        for ext in ("yaml", "yml"):
            path = REGISTRY_DIR / f"{product_id}.{ext}"
            if path.exists():
                path.unlink()
                logger.info("Deleted manifest file %s", path)
                break

    logger.info("Deregistered product: %s", product_id)
    return True
