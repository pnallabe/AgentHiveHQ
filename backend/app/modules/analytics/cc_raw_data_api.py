"""
CC Raw Data API — paginated access to all six CC analytics tables.

Mounted at: /api/analytics/cc-data

Endpoints
---------
    GET /api/analytics/cc-data/products               — dim_product catalogue (11 rows)
    GET /api/analytics/cc-data/customers              — paginated customer records
    GET /api/analytics/cc-data/originations           — paginated originations
    GET /api/analytics/cc-data/statements             — paginated monthly statements (year+month required)
    GET /api/analytics/cc-data/transactions           — paginated transactions (year+month required)
    GET /api/analytics/cc-data/credit-limit-events    — paginated credit-limit events

All endpoints require the ``executive`` Firebase custom claim unless
``ANALYTICS_SKIP_AUTH=true`` is set in the environment.

Pagination
----------
All list endpoints accept ``page`` (1-based, default 1) and
``page_size`` (default 100, max 1000).  The response always includes
``total``, ``page``, ``page_size``, and ``data``.
"""
from __future__ import annotations

import os
from typing import Annotated, Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import require_executive_role
from app.modules.analytics.cc_adapter import get_cc_adapter

router = APIRouter()

_SKIP_AUTH = os.getenv("ANALYTICS_SKIP_AUTH", "false").lower() == "true"

if _SKIP_AUTH:
    async def _auth_dep() -> dict:
        return {"role": "executive", "uid": "dev-user"}
else:
    _auth_dep = require_executive_role  # type: ignore[assignment]

ExecutiveDep = Annotated[dict, Depends(_auth_dep)]

_MAX_PAGE_SIZE = 1000


def _paginate(df: pd.DataFrame, page: int, page_size: int) -> dict:
    """Slice a DataFrame into a page response."""
    total = len(df)
    start = (page - 1) * page_size
    end = start + page_size
    rows = df.iloc[start:end].to_dict(orient="records")
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": rows,
    }


def _validate_page(page: int, page_size: int) -> None:
    if page < 1:
        raise HTTPException(status_code=422, detail="page must be >= 1")
    if not (1 <= page_size <= _MAX_PAGE_SIZE):
        raise HTTPException(status_code=422, detail=f"page_size must be 1–{_MAX_PAGE_SIZE}")


# ─────────────────────────────────────────────────────────────────────────────
# GET /products
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/products", tags=["Analytics — CC Raw Data"])
async def get_products(
    product_type: Optional[str] = Query(None, description="Filter by product_type: credit_card | mortgage"),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Return the full dim_product catalogue (up to 11 rows).

    Columns: product_code, product_name, product_type, annual_fee_usd,
             rate_min, rate_max, rewards_rate, min_fico, market_share
    """
    adapter = get_cc_adapter()
    df = adapter._parquet("dim_product/dim_product.parquet")
    if df.empty:
        return {"total": 0, "data": []}
    if product_type:
        df = df[df["product_type"] == product_type]
    return {"total": len(df), "data": df.to_dict(orient="records")}


# ─────────────────────────────────────────────────────────────────────────────
# GET /customers
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/customers", tags=["Analytics — CC Raw Data"])
async def get_customers(
    customer_id: Optional[str] = Query(None, description="Filter to a single customer_id"),
    state: Optional[str] = Query(None, description="Filter by US state abbreviation"),
    thin_file: Optional[bool] = Query(None, description="Filter by thin_file flag"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=_MAX_PAGE_SIZE),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Paginated customer demographics.

    Columns: customer_id, date_of_birth, gender, state, zip3,
             employment_type, income_annual_usd, education_level,
             marital_status, has_mortgage, has_deposit_account,
             bureau_score_at_first_cc_app, thin_file, customer_since_year
    """
    _validate_page(page, page_size)
    adapter = get_cc_adapter()
    df = adapter._parquet("customers/customers.parquet")
    if df.empty:
        return {"total": 0, "page": page, "page_size": page_size, "data": []}
    if customer_id:
        df = df[df["customer_id"] == customer_id]
    if state:
        df = df[df["state"] == state.upper()]
    if thin_file is not None:
        df = df[df["thin_file"] == thin_file]
    return _paginate(df, page, page_size)


# ─────────────────────────────────────────────────────────────────────────────
# GET /originations
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/originations", tags=["Analytics — CC Raw Data"])
async def get_originations(
    product_id: Optional[str] = Query(None, description="Filter by product code e.g. CC_REWARDS"),
    decision: Optional[str] = Query(None, description="Filter by decision: APPROVED | DECLINED | REFERRED"),
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD (origination_date >=)"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD (origination_date <=)"),
    customer_id: Optional[str] = Query(None, description="Filter to a single customer_id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=_MAX_PAGE_SIZE),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Paginated origination records.

    Columns: origination_id, customer_id, product_id, origination_date,
             bureau_score_at_orig, income_verified_usd, credit_limit_usd,
             apr_purchase, annual_fee_usd, channel, promotional_apr,
             promo_end_date, credit_bureau_pull_type, decision,
             decision_reason_code, underwriter_id
    """
    _validate_page(page, page_size)
    adapter = get_cc_adapter()
    df = adapter._parquet("cc_originations/cc_originations.parquet")
    if df.empty:
        return {"total": 0, "page": page, "page_size": page_size, "data": []}
    if product_id:
        df = df[df["product_id"] == product_id]
    if decision:
        df = df[df["decision"] == decision.upper()]
    if customer_id:
        df = df[df["customer_id"] == customer_id]
    if date_from:
        df = df[pd.to_datetime(df["origination_date"]) >= pd.to_datetime(date_from)]
    if date_to:
        df = df[pd.to_datetime(df["origination_date"]) <= pd.to_datetime(date_to)]
    return _paginate(df, page, page_size)


# ─────────────────────────────────────────────────────────────────────────────
# GET /statements
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/statements", tags=["Analytics — CC Raw Data"])
async def get_statements(
    year: int = Query(..., description="Statement year (2015–2024)"),
    month: int = Query(..., ge=1, le=12, description="Statement month (1–12)"),
    product_id: Optional[str] = Query(None, description="Filter by product code"),
    delinquency_status: Optional[str] = Query(None, description="Filter by delinquency_status"),
    customer_id: Optional[str] = Query(None, description="Filter to a single customer_id"),
    origination_id: Optional[str] = Query(None, description="Filter to a single origination_id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=_MAX_PAGE_SIZE),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Paginated monthly statement rows for a given year+month partition.

    Columns: statement_id, origination_id, customer_id, product_id,
             statement_date, year, month, balance_usd, credit_limit_usd,
             utilization_rate, minimum_payment_usd, actual_payment_usd,
             payment_ratio, purchase_volume_usd, cash_advance_usd,
             balance_transfer_usd, fee_revenue_usd, interest_revenue_usd,
             interchange_revenue_usd, rewards_cost_usd, delinquency_status,
             days_past_due, account_age_months, bureau_score_current,
             macro_period
    """
    _validate_page(page, page_size)
    if year < 2015 or year > 2024:
        raise HTTPException(status_code=422, detail="year must be between 2015 and 2024")
    adapter = get_cc_adapter()
    df = adapter._stmt_parquet(year, month)
    if df.empty:
        return {"total": 0, "page": page, "page_size": page_size, "data": []}
    if product_id:
        df = df[df["product_id"] == product_id]
    if delinquency_status:
        df = df[df["delinquency_status"] == delinquency_status.upper()]
    if customer_id:
        df = df[df["customer_id"] == customer_id]
    if origination_id:
        df = df[df["origination_id"] == origination_id]
    return _paginate(df, page, page_size)


# ─────────────────────────────────────────────────────────────────────────────
# GET /transactions
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/transactions", tags=["Analytics — CC Raw Data"])
async def get_transactions(
    year: int = Query(..., description="Transaction year (2015–2024)"),
    month: int = Query(..., ge=1, le=12, description="Transaction month (1–12)"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction_type: PURCHASE | CASH_ADVANCE | BALANCE_TRANSFER | REFUND"),
    customer_id: Optional[str] = Query(None, description="Filter to a single customer_id"),
    origination_id: Optional[str] = Query(None, description="Filter to a single origination_id"),
    merchant_category_code: Optional[str] = Query(None, description="Filter by MCC"),
    is_international: Optional[bool] = Query(None, description="Filter international transactions"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=_MAX_PAGE_SIZE),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Paginated transaction rows for a given year+month partition.

    Columns: transaction_id, origination_id, customer_id, transaction_date,
             year, month, merchant_category_code, merchant_name, amount_usd,
             transaction_type, is_international, is_contactless, is_online
    """
    _validate_page(page, page_size)
    if year < 2015 or year > 2024:
        raise HTTPException(status_code=422, detail="year must be between 2015 and 2024")
    adapter = get_cc_adapter()
    df = adapter._txn_parquet(year, month)
    if df.empty:
        return {"total": 0, "page": page, "page_size": page_size, "data": []}
    if transaction_type:
        df = df[df["transaction_type"] == transaction_type.upper()]
    if customer_id:
        df = df[df["customer_id"] == customer_id]
    if origination_id:
        df = df[df["origination_id"] == origination_id]
    if merchant_category_code:
        df = df[df["merchant_category_code"] == merchant_category_code]
    if is_international is not None:
        df = df[df["is_international"] == is_international]
    return _paginate(df, page, page_size)


# ─────────────────────────────────────────────────────────────────────────────
# GET /credit-limit-events
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/credit-limit-events", tags=["Analytics — CC Raw Data"])
async def get_credit_limit_events(
    event_type: Optional[str] = Query(None, description="Filter by event_type: CLI | CLD | INITIAL"),
    trigger: Optional[str] = Query(None, description="Filter by trigger e.g. PERIODIC_REVIEW | BUREAU_TRIGGER"),
    customer_id: Optional[str] = Query(None, description="Filter to a single customer_id"),
    origination_id: Optional[str] = Query(None, description="Filter to a single origination_id"),
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD (event_date >=)"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD (event_date <=)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=_MAX_PAGE_SIZE),
    _token: ExecutiveDep = None,  # type: ignore[assignment]
) -> dict:
    """Paginated credit-limit change events.

    Columns: event_id, origination_id, customer_id, event_date, event_type,
             previous_limit_usd, new_limit_usd, trigger, bureau_score_at_event
    """
    _validate_page(page, page_size)
    adapter = get_cc_adapter()
    df = adapter._parquet("cc_credit_limit_events/cc_credit_limit_events.parquet")
    if df.empty:
        return {"total": 0, "page": page, "page_size": page_size, "data": []}
    if event_type:
        df = df[df["event_type"] == event_type.upper()]
    if trigger:
        df = df[df["trigger"] == trigger.upper()]
    if customer_id:
        df = df[df["customer_id"] == customer_id]
    if origination_id:
        df = df[df["origination_id"] == origination_id]
    if date_from:
        df = df[pd.to_datetime(df["event_date"]) >= pd.to_datetime(date_from)]
    if date_to:
        df = df[pd.to_datetime(df["event_date"]) <= pd.to_datetime(date_to)]
    return _paginate(df, page, page_size)
