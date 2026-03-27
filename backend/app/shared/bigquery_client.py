"""Singleton Google BigQuery client for AgentHiveHQ.

This module provides the single shared BigQuery client used across the
entire platform.  It is initialised lazily on first use so the backend
boots without crashing if GCP credentials are absent (e.g. during unit
tests that mock the datasource).

Usage
-----
    from app.shared.bigquery_client import get_bq_client, bq_query

    # Raw client (for advanced / streaming queries)
    client = get_bq_client()

    # Convenience wrapper — returns a list[dict] from any SQL string
    rows = await bq_query("SELECT COUNT(*) AS n FROM `ai-risk-workflow.freddie_mac_sflld.freddie_origination`")
"""
from __future__ import annotations

import asyncio
import logging
import os
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_BQ_AVAILABLE: bool | None = None  # None = not yet probed


def _is_bq_available() -> bool:
    """Return True if google-cloud-bigquery is installed and importable."""
    global _BQ_AVAILABLE
    if _BQ_AVAILABLE is None:
        try:
            import google.cloud.bigquery  # noqa: F401
            _BQ_AVAILABLE = True
        except ImportError:
            _BQ_AVAILABLE = False
            logger.warning(
                "google-cloud-bigquery not installed — BigQuery datasource disabled. "
                "Install with: pip install google-cloud-bigquery db-dtypes"
            )
    return _BQ_AVAILABLE


@lru_cache(maxsize=1)
def get_bq_client() -> Any:  # returns google.cloud.bigquery.Client
    """Return the singleton BigQuery client.

    Credentials are resolved in priority order:
      1. GCP_CREDENTIALS_PATH env var (path to a service-account JSON key)
      2. GOOGLE_APPLICATION_CREDENTIALS env var (standard GCP ADC path)
      3. Application Default Credentials (gcloud auth / Cloud Run / GKE)

    Returns None if google-cloud-bigquery is not installed.
    """
    if not _is_bq_available():
        return None

    from app.core.config import settings
    from google.cloud import bigquery
    from google.oauth2 import service_account

    project = settings.GCP_PROJECT_ID
    creds_path = settings.GCP_CREDENTIALS_PATH or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")

    if creds_path and os.path.isfile(creds_path):
        credentials = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=["https://www.googleapis.com/auth/bigquery.readonly"],
        )
        client = bigquery.Client(project=project, credentials=credentials)
        logger.info(
            "BigQuery client initialised (service-account key)",
            extra={"project": project, "key": creds_path},
        )
    else:
        # Fall back to ADC — works on Cloud Run, GKE, and with `gcloud auth login`
        client = bigquery.Client(project=project)
        logger.info(
            "BigQuery client initialised (ADC / default credentials)",
            extra={"project": project},
        )

    return client


async def bq_query(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Run *sql* against BigQuery and return results as a list of dicts.

    This is a thin async wrapper — the actual query runs in an executor
    thread so it does not block the FastAPI event loop.

    Args:
        sql:    Standard SQL string.  Use ``@param_name`` placeholders and
                pass values via *params* to prevent injection.
        params: Mapping of ``param_name → value``.  Values are type-inferred
                by the BigQuery client library.

    Returns:
        List of row dicts, or ``[]`` if BigQuery is unavailable.
    """
    client = get_bq_client()
    if client is None:
        logger.debug("bq_query skipped — BigQuery client not available")
        return []

    from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter

    job_config: QueryJobConfig | None = None
    if params:
        from google.cloud.bigquery import ScalarQueryParameter
        query_params = []
        for name, value in params.items():
            if isinstance(value, int):
                query_params.append(ScalarQueryParameter(name, "INT64", value))
            elif isinstance(value, float):
                query_params.append(ScalarQueryParameter(name, "FLOAT64", value))
            else:
                query_params.append(ScalarQueryParameter(name, "STRING", str(value)))
        job_config = QueryJobConfig(query_parameters=query_params)

    loop = asyncio.get_running_loop()

    def _run() -> list[dict[str, Any]]:
        job = client.query(sql, job_config=job_config)
        return [dict(row) for row in job.result()]

    try:
        return await loop.run_in_executor(None, _run)
    except Exception as exc:
        logger.error("BigQuery query failed", extra={"error": str(exc), "sql": sql[:200]})
        return []
