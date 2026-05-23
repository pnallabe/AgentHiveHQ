# AgentHive – Executive Analytics Dashboard
## Feature Coding Prompt (Production-Grade)

---

> **Persona**: You are a senior full-stack engineer and financial analytics architect with 12+ years building internal management information systems (MIS) for financial services firms. Your dashboard will be reviewed by a Chief Financial Officer, Chief Risk Officer, Chief Operating Officer, and a Head of Compliance. Every metric, chart, and projection must be traceable to a real financial definition.
>
> **Standard**: This is not a marketing dashboard. It is an operational command centre for senior management making $100M+ lending decisions. No toy charts. No vague "revenue" labels — every figure must carry units, time period, and source. Build it as if a CRO is presenting this to the board next Monday morning.

---

## 0. FEATURE CONTEXT

### What Already Exists (AgentHiveHQ codebase)
The platform is a **Next.js 14 App Router** application with:
- **Frontend**: TypeScript, Tailwind CSS, shadcn/ui, Firebase Auth, Genkit AI (Google Gemini 2.0 Flash)
- **Existing pages**: `/dashboard`, `/lab/underwriting`, `/lab/copilot`, `/lab/governance`, `/rulesense`
- **Existing AI flows**: `rulesense-flow.ts`, `regulatory-update-flow.ts`, `credit-copilot-flow.ts`
- **Auth**: Firebase Auth with `AuthProvider` context + `withAuth` HOC
- **Backend**: FastAPI at `/backend/` with modules for `underwriting`, `copilot`, `governance`
- **UI kit**: Full shadcn/ui library + Recharts installed

### Business Context
This platform now operates as a **financial services firm** offering two lending products:

| Product | Description |
|---|---|
| **Credit Cards** | Revolving consumer credit; decisions already powered by the Underwriting Engine (`/lab/underwriting`) |
| **Mortgages** | Secured home loans; new product line with its own origination funnel, risk profile, and balance sheet contribution |

Senior leadership (CEO, CFO, CRO, COO) need a **single glass pane** to monitor the health of both portfolios, track against plan, and make capital allocation, pricing, and risk appetite decisions — without digging into product-specific tooling.

### What You Are Building
A new product vertical: **`/analytics`** — an internal executive dashboard accessible only to users with the `executive` role.

**Do NOT rewrite what exists. Integrate and extend.**

---

## 1. TECH STACK (STRICT — NO DEVIATIONS)

### Frontend (extend existing)
| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (already configured) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui (already installed) |
| Charts | Recharts (already installed) |
| State | React hooks + Context API (no Redux) |
| Data fetching | Native `fetch` + SWR for auto-refresh (install SWR if not present) |
| AI/LLM | Google Genkit + Gemini 2.0 Flash (configured in `src/ai/genkit.ts`) |
| Auth | Firebase Auth + new `executive` role check (`src/contexts/auth-context.tsx`) |

### Backend (extend existing FastAPI service)
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111+ (extend existing `backend/app/main.py`) |
| New module path | `backend/app/modules/analytics/` |
| Data — Credit Cards | PostgreSQL (async SQLAlchemy) **or** Parquet fallback — tables in `credit-risk-platform` schema |
| Data — Loans | Google BigQuery — project `ai-risk-workflow`, dataset `credit_risk_model_dev` |
| BQ Client | Reuse `credit-risk-platform/db/bigquery_client.py` — copy into `backend/app/shared/bq_client.py` |
| Projections | NumPy + SciPy (linear regression + Monte Carlo) |
| AI insights | Google Genkit / Gemini 2.0 Flash (consistent with existing flow pattern) |
| Caching | In-memory `functools.lru_cache` with TTL decorator (no Redis for v1) |
| Testing | pytest + httpx (existing conftest) |

---

## 2. SYSTEM ARCHITECTURE

```
Browser (Next.js 14)
│
├── /analytics ──────────────────────────────────────────┐
│   ├── /analytics/overview        (Executive Overview)  │
│   ├── /analytics/financial       (Financial KPIs)      │
│   ├── /analytics/operational     (Operational KPIs)    │
│   ├── /analytics/risk            (Risk & Portfolio)    │
│   ├── /analytics/projections     (Forward Projections) │
│   └── /analytics/corporate       (Corporate Metrics)   │
│                                                         ▼
│                                          src/lib/api.ts (existing typed fetch)
│                                                         │
│                              ┌──────────────────────────┴──────────────────────┐
│                              │         FastAPI Backend (Python)                 │
│                              │                                                  │
│                              │   /api/analytics/overview                        │
│                              │   /api/analytics/financial                       │
│                              │   /api/analytics/operational                     │
│                              │   /api/analytics/risk                            │
│                              │   /api/analytics/projections                     │
│                              │   /api/analytics/corporate                       │
│                              │   /api/analytics/ai-narrative                    │
│                              │   /api/analytics/export/pdf                      │
│                              │                                                  │
│                              │  ┌───────────────────────────────────────────┐   │
│                              │  │   analytics/ module                        │   │
│                              │  │                                            │   │
│                              │  │  api.py → service.py → aggregator.py      │   │
│                              │  │  schemas.py   projections.py              │   │
│                              │  │         ↓                                 │   │
│                              │  │  shared/db_models.py (existing + new)     │   │
│                              │  └───────────────────────────────────────────┘   │
│                              │                                                  │
│                              └──────────────────────────────────────────────────┘
│
└── Genkit AI flow (server action — stays in Next.js)
    └── src/ai/flows/executive-brief-flow.ts  (NEW — AI narrative for exec summary)
```

**Role-based access rule**: The `/analytics` route and all `/api/analytics/*` endpoints require the user to have `custom_claim: { role: "executive" }` in their Firebase ID token. Any other authenticated user receives HTTP 403. Unauthenticated users are redirected to `/login`.

---

## 3. COMPLETE FILE STRUCTURE

### Frontend additions (under `src/`)

```
src/
├── app/
│   └── analytics/
│       ├── layout.tsx                    # Analytics shell — persistent top nav + sidebar
│       ├── page.tsx                      # Redirect to /analytics/overview
│       ├── overview/
│       │   └── page.tsx                  # Executive Overview (hero KPI cards + AI brief)
│       ├── financial/
│       │   └── page.tsx                  # Financial KPIs (NII, NIM, ROE, ROA, cost of funds)
│       ├── operational/
│       │   └── page.tsx                  # Operational KPIs (originations, STP rate, TAT, etc.)
│       ├── risk/
│       │   └── page.tsx                  # Risk & Portfolio (NPL, ECL, vintage curves, LTV)
│       ├── projections/
│       │   └── page.tsx                  # Forward Projections (12/24-month revenue + loss)
│       └── corporate/
│           └── page.tsx                  # Corporate Metrics (CAC, LTV:CAC, headcount, NPS)
│
├── components/
│   └── analytics/
│       ├── AnalyticsShell.tsx            # Shell: top bar with period picker + export button
│       ├── KpiCard.tsx                   # Stat card: label, value, unit, delta, trend sparkline
│       ├── KpiCardGrid.tsx               # Responsive 2/3/4-col grid of KpiCards
│       ├── TrendChart.tsx                # Recharts LineChart wrapper (dual-axis capable)
│       ├── BarComparisonChart.tsx        # Side-by-side bar for product/segment breakdown
│       ├── WaterfallChart.tsx            # Revenue/cost waterfall (P&L build-up)
│       ├── VintageCurveChart.tsx         # Cohort delinquency curves by origination month
│       ├── HeatmapTable.tsx              # Risk matrix / concentration table with colour bands
│       ├── ProjectionBand.tsx            # Line chart with confidence interval shading
│       ├── AiBriefCard.tsx               # Collapsible AI-generated executive narrative
│       ├── PeriodPicker.tsx              # MTD / QTD / YTD / custom date range selector
│       ├── ProductToggle.tsx             # All / Credit Cards / Mortgages filter
│       ├── ExportButton.tsx              # Triggers PDF export API call
│       └── DataFreshnessTag.tsx          # "Data as of HH:MM UTC" badge
│
├── hooks/
│   └── useAnalytics.ts                   # SWR-based data fetching hooks per endpoint
│
├── lib/
│   └── analytics-api.ts                  # Typed fetch wrappers for /api/analytics/*
│
└── ai/
    └── flows/
        └── executive-brief-flow.ts       # Genkit flow: generates 3-bullet AI brief
```

### Backend additions (extend `backend/app/modules/`)

```
backend/app/modules/analytics/
├── __init__.py
├── api.py                                # FastAPI router — mounts all analytics endpoints
├── service.py                            # Orchestrates aggregator, projections, AI narrative
├── aggregator.py                         # Pulls + aggregates data from DecisionRecord + LoanRecord
├── projections.py                        # NumPy/SciPy forward models (linear + Monte Carlo)
├── schemas.py                            # Pydantic v2 request/response models (all KPI types)
└── export.py                             # PDF rendering (WeasyPrint or reportlab)

backend/app/shared/
└── db_models.py                          # ADD: LoanRecord, MortgageApplication, PortfolioSnapshot
```

---

## 4. DATA SOURCES & CONNECTION LAYER

### 4.0 Overview — Two Real Data Sources

The analytics module reads from **two existing, separate data systems** inside the `credit-risk-platform` project. Do not create new synthetic data — query the real sources and materialise a `PortfolioSnapshot` roll-up for trend charts.

| Product | Source Type | Location | Primary Tables |
|---|---|---|---|
| **Credit Cards** | PostgreSQL (async) **+** Parquet fallback | `credit_risk_cards` DB | `card_accounts`, `card_transactions`, `card_statements` |
| **Loans (incl. Mortgages)** | Google BigQuery | `ai-risk-workflow.credit_risk_model_dev` | `loan_applications`, `model_scores`, `credit_decisions`, `fair_lending_reports`, `model_registry` |
| **CC PD / origination** | Parquet (always available) | `credit-risk-platform/data/raw/cc_pd/` | `origination_5m.parquet`, `pd_training_5m.parquet`, `txn_summary_5m.parquet`, `cost_assumptions.parquet` |
| **Loan applications** | Parquet (always available) | `credit-risk-platform/data/raw/` | `loan_applications.parquet`, `loan_applications_test.parquet` |

### 4.1 Environment Variables

Add to both `backend/.env` and `AgentHiveHQ/.env.local`:

```bash
# ── Credit Cards (PostgreSQL) ──────────────────────────────────────────────
CC_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/credit_risk_cards
# Fallback to Parquet when Postgres is unavailable (set to "true" in dev/demo):
CC_USE_PARQUET_FALLBACK=true
CC_PARQUET_DIR=/path/to/credit-risk-platform/data/raw/cc_pd

# ── Loans (BigQuery) ──────────────────────────────────────────────────────
GCP_PROJECT_ID=ai-risk-workflow
BQ_DATASET_MODEL_DEV=credit_risk_model_dev
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credit-risk-platform/data/GCS_SA_KEY.json
# Fallback to Parquet when BQ is unavailable:
BQ_USE_PARQUET_FALLBACK=true
BQ_PARQUET_LOAN_APPS=/path/to/credit-risk-platform/data/raw/loan_applications.parquet
```

> **Security**: `GCS_SA_KEY.json` must never be committed. Add to `.gitignore`. In production, use `GOOGLE_APPLICATION_CREDENTIALS` pointing to a mounted secret or Workload Identity.

### 4.2 BigQuery Client (`backend/app/shared/bq_client.py`)

Copy `credit-risk-platform/db/bigquery_client.py` verbatim into `backend/app/shared/bq_client.py`. This module already implements:
- Singleton `get_bq_client()` authenticated via service account key or ADC
- `query_to_df(sql)` → `pd.DataFrame`
- `read_table(table_id, dataset_id, where, limit)` → `pd.DataFrame`
- Auto `.env` loading
- Graceful fallback when `google-cloud-bigquery` is not installed

Add one additional helper for analytics:

```python
# backend/app/shared/bq_client.py  — ADD below existing functions

def query_period(
    table: str,
    ts_column: str,
    date_from: str,
    date_to: str,
    extra_where: str = "",
    dataset: str = DEFAULT_DATASET,
    project: str = DEFAULT_PROJECT,
) -> pd.DataFrame:
    """
    Period-filtered BQ query with partition pruning.
    date_from / date_to: ISO strings e.g. '2026-01-01'
    """
    where = f"{ts_column} >= '{date_from}' AND {ts_column} < '{date_to}'"
    if extra_where:
        where = f"{where} AND {extra_where}"
    return read_table(table, dataset_id=dataset, project=project, where=where)
```

### 4.3 Credit Card Data Adapter (`backend/app/modules/analytics/cc_adapter.py`)

Abstracts over PostgreSQL vs Parquet, always returning a canonical DataFrame.

```python
# backend/app/modules/analytics/cc_adapter.py

import os
from pathlib import Path
from typing import Optional
import pandas as pd

USE_PARQUET = os.getenv("CC_USE_PARQUET_FALLBACK", "true").lower() == "true"
PARQUET_DIR = Path(os.getenv("CC_PARQUET_DIR", "data/raw/cc_pd"))

# ── Canonical column contract for the aggregator layer ─────────────────────
# All adapters MUST return DataFrames with these columns (NaN if not available)

CC_ACCOUNTS_COLUMNS = [
    # Identifiers
    "card_account_id",          # UUID str
    "customer_id",              # UUID str
    "product_id",

    # Status & dates
    "account_status",           # active | suspended | closed | charged_off | fraud_hold | credit_hold
    "account_open_date",        # date
    "account_close_date",       # date (nullable)
    "card_activation_date",     # date (nullable)

    # Balance & limits
    "credit_limit",             # Decimal — original approved limit (= card original_balance)
    "current_balance",          # Decimal
    "credit_utilization",       # Computed: current_balance / credit_limit

    # Risk
    "current_delinquency_days", # int — current DPD bucket
    "times_30dpd",              # int — lifetime delinquency count
    "times_60dpd",
    "times_90dpd",

    # Revenue proxy (derive from APR × balance if no income field)
    "purchase_apr",             # from card_products JOIN — annualised rate
    "months_on_book",

    # Acquisition
    "origination_channel",      # mapped from card_type or acquisition metadata
]

CC_ORIGINATIONS_COLUMNS = [
    # From origination_5m.parquet (cc_pd folder)
    # Key fields expected:
    "account_id",
    "open_date",
    "credit_limit",
    "risk_segment",             # prime | near_prime | high_risk | thin_file
    "interest_rate",            # APR
    "channel",
    "acquisition_cost",
]


def load_cc_accounts(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Load credit card accounts. Uses Parquet when CC_USE_PARQUET_FALLBACK=true.
    Parquet path: $CC_PARQUET_DIR/origination_5m.parquet
    """
    if USE_PARQUET:
        df = pd.read_parquet(PARQUET_DIR / "origination_5m.parquet")
        if date_from:
            df = df[df["open_date"] >= pd.to_datetime(date_from)]
        if date_to:
            df = df[df["open_date"] < pd.to_datetime(date_to)]
        return df
    else:
        # PostgreSQL async read — wrap in asyncio.run() or use existing session
        from backend.app.database import get_sync_session  # noqa — implement if needed
        raise NotImplementedError("PostgreSQL path not yet implemented for CC adapter")


def load_cc_pd_scores(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Load CC default/PD scores from pd_training_5m.parquet.
    Key columns: account_id, pd_score, default_flag, risk_segment, scored_at
    """
    df = pd.read_parquet(PARQUET_DIR / "pd_training_5m.parquet")
    if date_from:
        df = df[df["scored_at"] >= pd.to_datetime(date_from)] if "scored_at" in df.columns else df
    return df


def load_cc_txn_summary(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Load transaction summary from txn_summary_5m.parquet.
    Key columns: account_id, period, total_spend, total_payments,
                 interest_charged, fees_charged, statement_balance
    """
    df = pd.read_parquet(PARQUET_DIR / "txn_summary_5m.parquet")
    return df


def load_cc_cost_assumptions() -> pd.DataFrame:
    """
    Load cost of funds and operating cost assumptions.
    Parquet path: $CC_PARQUET_DIR/cost_assumptions.parquet
    Key columns: product_tier, cost_of_funds_rate, operating_cost_per_account,
                 acquisition_cost_avg, period
    """
    return pd.read_parquet(PARQUET_DIR / "cost_assumptions.parquet")
```

### 4.4 Loan / BigQuery Data Adapter (`backend/app/modules/analytics/bq_adapter.py`)

```python
# backend/app/modules/analytics/bq_adapter.py

import os
from pathlib import Path
from typing import Optional
import pandas as pd

# Reuse the existing BigQuery client module
from app.shared.bq_client import query_period, query_to_df, DEFAULT_PROJECT, DEFAULT_DATASET

USE_BQ_PARQUET_FALLBACK = os.getenv("BQ_USE_PARQUET_FALLBACK", "true").lower() == "true"
PARQUET_LOAN_APPS = Path(os.getenv(
    "BQ_PARQUET_LOAN_APPS",
    "data/raw/loan_applications.parquet"
))


def load_loan_applications(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.loan_applications`
    Parquet fallback: credit-risk-platform/data/raw/loan_applications.parquet

    Key columns returned:
      application_id, submitted_at, loan_amount, loan_purpose, loan_term_months,
      annual_income, employment_status, employer_tenure_months, dti,
      credit_score, borrower_state, channel, is_thin_file,
      avg_monthly_cash_inflow, avg_monthly_cash_outflow
    """
    if USE_BQ_PARQUET_FALLBACK:
        df = pd.read_parquet(PARQUET_LOAN_APPS)
        if date_from and "submitted_at" in df.columns:
            df = df[df["submitted_at"] >= pd.to_datetime(date_from)]
        if date_to and "submitted_at" in df.columns:
            df = df[df["submitted_at"] < pd.to_datetime(date_to)]
        return df
    return query_period(
        "loan_applications", "submitted_at",
        date_from or "2000-01-01", date_to or "2100-01-01"
    )


def load_credit_decisions(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.credit_decisions`
    Key columns: application_id, decision (APPROVE/REJECT/MANUAL_REVIEW),
                 approved_amount, approved_rate, approved_term_months,
                 reason_codes, policy_version, decision_latency_ms, decided_at
    """
    if USE_BQ_PARQUET_FALLBACK:
        # Derive from loan_applications fallback — decisions not always in Parquet
        df = load_loan_applications(date_from, date_to)
        return df  # aggregator handles missing decision column gracefully
    return query_period(
        "credit_decisions", "decided_at",
        date_from or "2000-01-01", date_to or "2100-01-01"
    )


def load_model_scores(date_from: Optional[str] = None, date_to: Optional[str] = None) -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.model_scores`
    Key columns: application_id, pd_score, pd_band, fraud_probability, fraud_flag,
                 recommended_rate, expected_loss, expected_profit,
                 model_version, scored_at
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()  # not available in Parquet — aggregator skips
    return query_period(
        "model_scores", "scored_at",
        date_from or "2000-01-01", date_to or "2100-01-01"
    )


def load_fair_lending_reports() -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.fair_lending_reports`
    Key columns: protected_col, dir_score, dir_flag, protected_approval_rate,
                 control_approval_rate, approval_parity_flag, n_total, n_approved,
                 report_timestamp
    Used by: /analytics/risk (bias indicators) + corporate (compliance metrics)
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()
    return query_to_df(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.fair_lending_reports`"
        " ORDER BY report_timestamp DESC LIMIT 500"
    )


def load_model_registry() -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.model_registry`
    Key columns: model_name, model_version, status (champion/challenger/retired),
                 auc_cv, ks_stat, gini, precision, recall, f1_score,
                 training_rows, trained_at, promoted_at
    Used by: /analytics/corporate (model performance panel)
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()
    return query_to_df(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.model_registry`"
        " ORDER BY trained_at DESC LIMIT 100"
    )


def load_drift_reports(limit: int = 90) -> pd.DataFrame:
    """
    Source: `ai-risk-workflow.credit_risk_model_dev.drift_reports`
    Key columns: overall_drift_status, features_with_major_drift,
                 psi_summary_json, alert_triggered, report_timestamp
    Used by: /analytics/risk (model stability panel)
    """
    if USE_BQ_PARQUET_FALLBACK:
        return pd.DataFrame()
    return query_to_df(
        f"SELECT * FROM `{DEFAULT_PROJECT}.{DEFAULT_DATASET}.drift_reports`"
        f" ORDER BY report_timestamp DESC LIMIT {limit}"
    )
```

### 4.5 KPI Derivation Map — Source Columns → Dashboard Metrics

The `aggregator.py` MUST compute every dashboard KPI from the exact columns below. No approximations — if a column is missing in Parquet fallback mode, return `None` and surface a `data_availability: "partial"` flag in the API response.

#### Credit Card KPIs

| Dashboard KPI | Source Table | Source Columns | Formula |
|---|---|---|---|
| Total Accounts | `origination_5m.parquet` | `account_id` | `COUNT(DISTINCT account_id)` |
| Active Accounts | `origination_5m.parquet` | `account_id`, `account_status` | `COUNT WHERE account_status = 'active'` |
| New Originations (count) | `origination_5m.parquet` | `open_date` | `COUNT WHERE open_date IN period` |
| New Originations (volume £) | `origination_5m.parquet` | `open_date`, `credit_limit` | `SUM(credit_limit) WHERE open_date IN period` |
| Average Credit Limit | `origination_5m.parquet` | `credit_limit` | `AVG(credit_limit)` |
| Average Utilisation | `txn_summary_5m.parquet` | `statement_balance`, `credit_limit` | `AVG(statement_balance / credit_limit)` |
| NPL Rate (CC) | `pd_training_5m.parquet` | `default_flag`, `account_id` | `SUM(default_flag) / COUNT(account_id)` |
| PD Score Distribution | `pd_training_5m.parquet` | `pd_score`, `risk_segment` | `PERCENTILE + band counts` |
| Interest Income (proxy) | `txn_summary_5m.parquet` | `interest_charged` | `SUM(interest_charged) WHERE period` |
| Fee Income (proxy) | `txn_summary_5m.parquet` | `fees_charged` | `SUM(fees_charged) WHERE period` |
| Cost of Funds | `cost_assumptions.parquet` | `cost_of_funds_rate`, `credit_limit` | `SUM(credit_limit) × AVG(cost_of_funds_rate)` |
| Approval Rate | `origination_5m.parquet` + decisions | see note | `approved / (approved + rejected)` |
| Avg APR | `origination_5m.parquet` | `interest_rate` | `AVG(interest_rate)` |
| Risk Segment Mix | `origination_5m.parquet` | `risk_segment` | `COUNT GROUP BY risk_segment` |
| CAC (avg) | `cost_assumptions.parquet` | `acquisition_cost_avg` | Direct lookup |

> **Note on Approval Rate**: `origination_5m.parquet` contains approved accounts. Rejection count must come from BigQuery `credit_decisions` WHERE `decision = 'REJECT'`. In Parquet-fallback mode, approval rate is estimated as accounts_originated / (accounts_originated + thin_file_rejections_estimated).

#### Loan KPIs (BigQuery)

| Dashboard KPI | BQ Table | Columns | Formula |
|---|---|---|---|
| Loan Applications (count) | `loan_applications` | `application_id`, `submitted_at` | `COUNT WHERE submitted_at IN period` |
| Loan Originations (approved volume) | `credit_decisions` | `approved_amount`, `decided_at` | `SUM(approved_amount) WHERE decision='APPROVE'` |
| Average Loan Size | `credit_decisions` | `approved_amount` | `AVG(approved_amount)` |
| Approval Rate | `credit_decisions` | `decision` | `SUM(decision='APPROVE') / COUNT(*)` |
| Average Approved APR | `credit_decisions` | `approved_rate` | `AVG(approved_rate)` |
| Average DTI | `loan_applications` | `dti` | `AVG(dti)` |
| Thin-File Rate | `loan_applications` | `is_thin_file` | `SUM(is_thin_file) / COUNT(*)` |
| Expected Loss | `model_scores` | `expected_loss` | `SUM(expected_loss)` |
| Expected Profit | `model_scores` | `expected_profit` | `SUM(expected_profit)` |
| PD Score (avg by band) | `model_scores` | `pd_score`, `pd_band` | `AVG GROUP BY pd_band` |
| Decision Latency (p95) | `credit_decisions` | `decision_latency_ms` | `PERCENTILE_CONT(0.95)` |
| Policy Version Mix | `credit_decisions` | `policy_version` | `COUNT GROUP BY policy_version` |
| Fair Lending DIR | `fair_lending_reports` | `dir_score`, `dir_flag` | Latest report per attribute |
| Model Champion AUC | `model_registry` | `auc_cv`, `status` | `WHERE status = 'champion'` |
| Model Drift Status | `drift_reports` | `overall_drift_status` | Latest report |
| State Distribution | `loan_applications` | `borrower_state` | `COUNT GROUP BY borrower_state` |
| Channel Mix | `loan_applications` | `channel` | `COUNT GROUP BY channel` |

### 4.6 Parquet Fallback Behaviour

```
Data Availability Matrix:

         │ Postgres CC │ BigQuery │ CC Parquet │ Loan Parquet │ Mode
─────────┼─────────────┼──────────┼────────────┼──────────────┼───────────────────────
 Prod    │     ✓       │    ✓     │     —      │      —       │ Full live
 Dev     │     —       │    —     │     ✓      │      ✓       │ Full Parquet fallback
 Demo    │     —       │    —     │     ✓      │      ✓       │ Full Parquet fallback
 Partial │     —       │    ✓     │     ✓      │      —       │ CC Parquet + BQ live
─────────┴─────────────┴──────────┴────────────┴──────────────┴───────────────────────

  data_availability field in every API response:
    "full"     — all sources live
    "partial"  — one source unavailable; list missing_sources: ["bigquery"]
    "demo"     — Parquet only
```

All KPIs sourced from an unavailable data source must return `null` (never fabricated values) and the response must include:
```json
"data_availability": "partial",
"missing_sources": ["bigquery"],
"affected_kpis": ["npl_rate_loans", "approval_rate_loans", "expected_loss"]
```

## 5. DATABASE SCHEMA ADDITIONS

Add these models to `backend/app/shared/db_models.py`. All existing models stay untouched.

> **Important**: `LoanRecord` and `MortgageApplication` are **not** new source-of-truth tables. They are local **materialised caches** written by the analytics aggregator on a 15-minute schedule to serve fast dashboard reads without re-querying both external sources on every API call. The canonical sources remain the credit-risk-platform's PostgreSQL CC database (`card_accounts`, `card_transactions`) and BigQuery (`loan_applications`, `credit_decisions`). On a cache miss or first run, the aggregator populates these from the adapters.

### `LoanRecord` (local materialised cache — sourced from `origination_5m.parquet` + BigQuery `credit_decisions`)

```python
class LoanRecord(Base):
    __tablename__ = "loan_records"

    id: UUID                          # Primary key (uuid4)
    created_at: DateTime              # UTC
    updated_at: DateTime              # UTC (on_update)

    # Identifying attributes
    product_type: str                 # "credit_card" | "mortgage"
    decision_id: UUID                 # FK → decisions.id (nullable for mortgages)
    account_ref: str                  # Internal account number (hashed)

    # Origination data
    origination_date: Date
    original_balance: Numeric(14, 2)  # Credit cards: credit limit; Mortgages: loan amount
    original_ltv: Numeric(5, 4)       # Mortgages only; NULL for credit cards
    original_term_months: int         # 12–360
    origination_channel: str          # "digital" | "branch" | "broker"
    interest_rate: Numeric(5, 4)      # Annualised (e.g. 0.1999)
    risk_segment: str                 # "prime" | "near_prime" | "high_risk" | "thin_file"

    # Current balance snapshot (updated monthly by settlement job)
    current_balance: Numeric(14, 2)
    days_past_due: int                # 0 | 30 | 60 | 90 | 120+
    is_npl: bool                      # Non-performing: DPD >= 90
    is_charged_off: bool

    # Revenue attribution
    interest_income_mtd: Numeric(14, 2)
    fee_income_mtd: Numeric(14, 2)

    # Cost of funds (transfer pricing)
    cost_of_funds_rate: Numeric(5, 4) # Internal FTP rate

    # Marketing / acquisition
    acquisition_cost: Numeric(10, 2)  # CAC at origination
    acquisition_channel: str          # "organic" | "paid_search" | "affiliate" | "broker"
```

### `MortgageApplication` (local cache — sourced from BigQuery `loan_applications` WHERE `loan_type = 'mortgage'`)

```python
class MortgageApplication(Base):
    __tablename__ = "mortgage_applications"

    id: UUID
    created_at: DateTime
    updated_at: DateTime

    application_ref: str
    status: str                       # "submitted" | "in_review" | "approved" | "declined" | "funded" | "withdrawn"
    loan_amount: Numeric(14, 2)
    property_value: Numeric(14, 2)
    ltv_ratio: Numeric(5, 4)
    applicant_income: Numeric(12, 2)
    dti_ratio: Numeric(5, 4)
    credit_score: int
    product_type: str                 # "fixed_2yr" | "fixed_5yr" | "tracker" | "variable"
    processing_stage: str             # "document_collection" | "valuation" | "underwriting" | "offer"
    stp_processed: bool               # Straight-through processing (no human touch)
    processing_days: int              # Calendar days from submission to current status
    underwriter_id: str               # nullable if STP
    officer_notes: str                # nullable
```

### `PortfolioSnapshot` (aggregator output — monthly roll-up written from both CC Parquet + BigQuery sources)

```python
class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: UUID
    snapshot_date: Date               # Last day of the reporting month
    product_type: str                 # "credit_card" | "mortgage" | "total"

    # Volume
    total_accounts: int
    active_accounts: int
    new_originations_count: int
    new_originations_volume: Numeric(16, 2)

    # Balances
    total_outstanding: Numeric(16, 2)
    average_balance: Numeric(14, 2)

    # Revenue
    total_interest_income: Numeric(14, 2)
    total_fee_income: Numeric(14, 2)
    total_revenue: Numeric(14, 2)
    cost_of_funds: Numeric(14, 2)
    net_interest_income: Numeric(14, 2)
    net_interest_margin: Numeric(5, 4) # NII / avg earning assets

    # Risk
    npl_count: int
    npl_balance: Numeric(14, 2)
    npl_rate: Numeric(5, 4)           # npl_balance / total_outstanding
    ecl_provision: Numeric(14, 2)     # Expected Credit Loss provision
    net_charge_off_rate: Numeric(5, 4)

    # Efficiency
    cost_income_ratio: Numeric(5, 4)
    roe: Numeric(5, 4)                # Return on equity
    roa: Numeric(5, 4)                # Return on assets
    approval_rate: Numeric(5, 4)
    stp_rate: Numeric(5, 4)           # (mortgages) % of apps processed without human touch

    # Customer
    new_customers: int
    customer_acquisition_cost_avg: Numeric(10, 2)
    nps_score: Numeric(5, 2)          # -100 to +100
```

---

## 6. BACKEND IMPLEMENTATION GUIDE

### 5.1 Analytics Module File Structure (`analytics/`)

```
backend/app/modules/analytics/
├── __init__.py
├── api.py                 # FastAPI router
├── service.py             # Orchestrates adapters, aggregator, projections
├── aggregator.py          # Reads from cc_adapter + bq_adapter; computes KPIs
├── cc_adapter.py          # Credit card data adapter (PostgreSQL / Parquet)
├── bq_adapter.py          # Loan data adapter (BigQuery / Parquet)
├── projections.py         # NumPy/SciPy Monte Carlo forward models
├── schemas.py             # Pydantic v2 response models
└── export.py              # PDF generation
```

### 5.2 Analytics Router Mount (`analytics/api.py`)

Mount under the existing FastAPI app:

```python
# backend/app/main.py — ADD this line alongside existing routers
from app.modules.analytics.api import router as analytics_router
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
```

All analytics endpoints require the `executive` role. Enforce via a shared dependency:

```python
# backend/app/core/dependencies.py  — ADD
async def require_executive_role(token: str = Depends(get_firebase_token)):
    if token.get("role") != "executive":
        raise HTTPException(status_code=403, detail="Executive role required")
```

### 5.3 Aggregator (`aggregator.py`) — Real Data Queries

The aggregator reads from both adapters, computes KPIs, and returns typed dicts matching the Pydantic schemas. It never generates synthetic numbers — it runs real queries against the two data sources defined in Section 4.

```python
# backend/app/modules/analytics/aggregator.py

from __future__ import annotations
import asyncio
from datetime import date, timedelta
from typing import Optional
import numpy as np
import pandas as pd

from app.modules.analytics.cc_adapter import (
    load_cc_accounts, load_cc_pd_scores, load_cc_txn_summary, load_cc_cost_assumptions
)
from app.modules.analytics.bq_adapter import (
    load_loan_applications, load_credit_decisions, load_model_scores,
    load_fair_lending_reports, load_model_registry, load_drift_reports
)


def resolve_period(period: str, date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Resolve period string to (date_from_str, date_to_str) ISO strings."""
    today = date.today()
    if period == "mtd":
        return today.replace(day=1).isoformat(), today.isoformat()
    elif period == "qtd":
        q_start = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
        return q_start.isoformat(), today.isoformat()
    elif period == "ytd":
        return today.replace(month=1, day=1).isoformat(), today.isoformat()
    elif period == "last_30":
        return (today - timedelta(days=30)).isoformat(), today.isoformat()
    elif period == "last_90":
        return (today - timedelta(days=90)).isoformat(), today.isoformat()
    elif period == "last_12m":
        return (today - timedelta(days=365)).isoformat(), today.isoformat()
    elif period == "custom":
        return date_from, date_to
    else:
        return today.replace(day=1).isoformat(), today.isoformat()  # default: MTD


def compute_cc_kpis(df_orig: pd.DataFrame, df_pd: pd.DataFrame,
                   df_txn: pd.DataFrame, df_cost: pd.DataFrame) -> dict:
    """
    Compute all credit card KPIs from loaded DataFrames.
    Returns dict matching CreditCardOpsSchema.

    Column mapping (from cc_adapter):
      df_orig  : origination_5m.parquet    → account_id, credit_limit, interest_rate,
                                              risk_segment, channel, open_date
      df_pd    : pd_training_5m.parquet    → account_id, pd_score, default_flag, risk_segment
      df_txn   : txn_summary_5m.parquet    → account_id, period, interest_charged,
                                              fees_charged, statement_balance
      df_cost  : cost_assumptions.parquet  → cost_of_funds_rate, acquisition_cost_avg
    """
    total_accounts = df_orig["account_id"].nunique() if "account_id" in df_orig.columns else None

    # Active accounts: status column may not be in origination Parquet;
    # use active proxy: accounts with statement_balance > 0
    active_ids = df_txn[df_txn["statement_balance"] > 0]["account_id"].unique() \
        if "account_id" in df_txn.columns else None
    active_accounts = len(active_ids) if active_ids is not None else None

    avg_credit_limit = float(df_orig["credit_limit"].mean()) if "credit_limit" in df_orig.columns else None
    avg_apr = float(df_orig["interest_rate"].mean()) if "interest_rate" in df_orig.columns else None
    avg_util = None
    if "statement_balance" in df_txn.columns and "credit_limit" in df_orig.columns:
        merged = df_txn.merge(df_orig[["account_id", "credit_limit"]], on="account_id", how="left")
        merged = merged[merged["credit_limit"] > 0]
        merged["utilisation"] = merged["statement_balance"] / merged["credit_limit"]
        avg_util = float(merged["utilisation"].mean())

    npl_rate = float(df_pd["default_flag"].mean()) if "default_flag" in df_pd.columns else None

    interest_income = float(df_txn["interest_charged"].sum()) if "interest_charged" in df_txn.columns else None
    fee_income = float(df_txn["fees_charged"].sum()) if "fees_charged" in df_txn.columns else None

    cof_rate = float(df_cost["cost_of_funds_rate"].mean()) if not df_cost.empty else 0.055
    total_balance = float(df_txn["statement_balance"].sum()) if "statement_balance" in df_txn.columns else None
    cost_of_funds = total_balance * cof_rate if total_balance else None

    nii = (interest_income - cost_of_funds) if interest_income and cost_of_funds else None
    nim = (nii / total_balance) if nii and total_balance and total_balance > 0 else None

    risk_mix = df_orig["risk_segment"].value_counts(normalize=True).to_dict() \
        if "risk_segment" in df_orig.columns else {}
    channel_mix = df_orig["channel"].value_counts(normalize=True).to_dict() \
        if "channel" in df_orig.columns else {}
    cac_avg = float(df_cost["acquisition_cost_avg"].mean()) if not df_cost.empty else None

    return {
        "total_accounts": total_accounts,
        "active_accounts": active_accounts,
        "average_credit_limit": avg_credit_limit,
        "average_apr": avg_apr,
        "average_utilisation": avg_util,
        "npl_rate": npl_rate,
        "net_interest_income": nii,
        "net_interest_margin": nim,
        "interest_income": interest_income,
        "fee_income": fee_income,
        "cost_of_funds": cost_of_funds,
        "risk_segment_mix": risk_mix,
        "origination_channel_mix": channel_mix,
        "customer_acquisition_cost_avg": cac_avg,
    }


def compute_loan_kpis(df_apps: pd.DataFrame, df_decisions: pd.DataFrame,
                      df_scores: pd.DataFrame) -> dict:
    """
    Compute all loan KPIs from BigQuery DataFrames.
    Returns dict matching LoanOpsSchema.

    Column mapping (from bq_adapter):
      df_apps      : loan_applications  → application_id, loan_amount, loan_type,
                                          loan_term_months, annual_income, dti,
                                          credit_score, borrower_state, channel,
                                          employment_status, is_thin_file, submitted_at
      df_decisions : credit_decisions   → application_id, decision, approved_amount,
                                          approved_rate, reason_codes, policy_version,
                                          decision_latency_ms, decided_at
      df_scores    : model_scores       → application_id, pd_score, pd_band,
                                          expected_loss, expected_profit, model_version
    """
    total_apps = len(df_apps) if not df_apps.empty else None

    # Decision outcomes
    approved = df_decisions[df_decisions["decision"] == "APPROVE"] if not df_decisions.empty else pd.DataFrame()
    approval_rate = len(approved) / len(df_decisions) if len(df_decisions) > 0 else None
    originations_volume = float(approved["approved_amount"].sum()) if not approved.empty else None
    avg_loan_size = float(approved["approved_amount"].mean()) if not approved.empty else None
    avg_apr = float(approved["approved_rate"].mean()) if not approved.empty else None
    decision_latency_p95 = float(
        df_decisions["decision_latency_ms"].quantile(0.95)
    ) if "decision_latency_ms" in df_decisions.columns and not df_decisions.empty else None

    # Risk from model scores
    expected_loss = float(df_scores["expected_loss"].sum()) if "expected_loss" in df_scores.columns else None
    expected_profit = float(df_scores["expected_profit"].sum()) if "expected_profit" in df_scores.columns else None
    avg_pd = float(df_scores["pd_score"].mean()) if "pd_score" in df_scores.columns else None
    pd_band_dist = df_scores["pd_band"].value_counts(normalize=True).to_dict() \
        if "pd_band" in df_scores.columns else {}

    # Applicant profile
    avg_dti = float(df_apps["dti"].mean()) if "dti" in df_apps.columns else None
    avg_credit_score = float(df_apps["credit_score"].mean()) \
        if "credit_score" in df_apps.columns else None
    thin_file_rate = float(df_apps["is_thin_file"].mean()) \
        if "is_thin_file" in df_apps.columns else None
    state_dist = df_apps["borrower_state"].value_counts(normalize=True).head(10).to_dict() \
        if "borrower_state" in df_apps.columns else {}
    channel_mix = df_apps["channel"].value_counts(normalize=True).to_dict() \
        if "channel" in df_apps.columns else {}

    return {
        "total_applications": total_apps,
        "approval_rate": approval_rate,
        "originations_volume": originations_volume,
        "average_loan_size": avg_loan_size,
        "average_approved_apr": avg_apr,
        "decision_latency_p95_ms": decision_latency_p95,
        "expected_loss": expected_loss,
        "expected_profit": expected_profit,
        "average_pd_score": avg_pd,
        "pd_band_distribution": pd_band_dist,
        "average_dti": avg_dti,
        "average_credit_score": avg_credit_score,
        "thin_file_rate": thin_file_rate,
        "state_distribution": state_dist,
        "origination_channel_mix": channel_mix,
    }
```

### 5.4 API Contracts

All period parameters accept: `mtd` | `qtd` | `ytd` | `last_30` | `last_90` | `last_12m` | `custom` (requires `date_from` + `date_to`)

All monetary values returned in **GBP** (or the configured currency from env). Never mix currencies in a single response.

---

#### `GET /api/analytics/overview`

Returns the top-level executive summary for the period selector.

**Query params**: `period` (default: `mtd`), `product` (`all` | `credit_card` | `mortgage`)

**Response (200 OK):**
```json
{
  "period": "mtd",
  "product_filter": "all",
  "data_as_of": "2026-04-03T08:00:00Z",
  "headline_kpis": {
    "total_revenue": { "value": 142_300_000, "unit": "GBP", "delta_pct": 0.043, "vs": "prior_month" },
    "net_interest_income": { "value": 98_700_000, "unit": "GBP", "delta_pct": 0.031, "vs": "prior_month" },
    "total_originations_volume": { "value": 412_000_000, "unit": "GBP", "delta_pct": -0.018, "vs": "prior_month" },
    "npl_rate": { "value": 0.021, "unit": "ratio", "delta_pct": 0.002, "vs": "prior_month", "alert": false },
    "approval_rate": { "value": 0.68, "unit": "ratio", "delta_pct": -0.005, "vs": "prior_month" },
    "roe": { "value": 0.186, "unit": "ratio", "delta_pct": 0.003, "vs": "prior_quarter" }
  },
  "product_split": {
    "credit_card": { "revenue_share": 0.61, "originations_share": 0.38 },
    "mortgage": { "revenue_share": 0.39, "originations_share": 0.62 }
  },
  "plan_vs_actual": {
    "revenue_attainment": 0.97,
    "originations_attainment": 0.94,
    "npl_within_budget": true,
    "cost_income_ratio": { "actual": 0.534, "plan": 0.52, "status": "over_plan" }
  },
  "top_risks": [
    { "code": "NIM_COMPRESSION", "severity": "medium", "description": "NIM declined 18bps MoM driven by cost of funds increase" },
    { "code": "MTG_PIPELINE_DECLINE", "severity": "low", "description": "Mortgage pipeline 6% below plan — broker channel lag" }
  ]
}
```

---

#### `GET /api/analytics/financial`

**Query params**: `period`, `product`, `breakdown` (`monthly` | `quarterly`)

**Response (200 OK):**
```json
{
  "period": "ytd",
  "income_statement": {
    "interest_income": 284_100_000,
    "fee_income": 31_400_000,
    "total_revenue": 315_500_000,
    "cost_of_funds": 101_200_000,
    "net_interest_income": 213_900_000,
    "operating_costs": 168_500_000,
    "ecl_charge": 24_600_000,
    "profit_before_tax": 20_800_000
  },
  "margins": {
    "net_interest_margin": 0.0148,
    "nim_by_product": { "credit_card": 0.155, "mortgage": 0.012 },
    "cost_income_ratio": 0.534,
    "return_on_equity": 0.186,
    "return_on_assets": 0.021
  },
  "revenue_trend": [
    { "period": "2026-01", "interest_income": 91_400_000, "fee_income": 10_200_000, "cost_of_funds": 33_100_000 },
    { "period": "2026-02", "interest_income": 95_300_000, "fee_income": 10_600_000, "cost_of_funds": 33_900_000 },
    { "period": "2026-03", "interest_income": 97_400_000, "fee_income": 10_600_000, "cost_of_funds": 34_200_000 }
  ],
  "waterfall": {
    "items": [
      { "label": "Interest Income", "value": 284_100_000, "type": "positive" },
      { "label": "Fee Income", "value": 31_400_000, "type": "positive" },
      { "label": "Cost of Funds", "value": -101_200_000, "type": "negative" },
      { "label": "Operating Costs", "value": -168_500_000, "type": "negative" },
      { "label": "ECL Charge", "value": -24_600_000, "type": "negative" },
      { "label": "Profit Before Tax", "value": 20_800_000, "type": "subtotal" }
    ]
  }
}
```

---

#### `GET /api/analytics/operational`

**Query params**: `period`, `product`

**Response (200 OK):**
```json
{
  "originations": {
    "total_count": 138_400,
    "total_volume_gbp": 1_240_000_000,
    "by_product": {
      "credit_card": { "count": 121_000, "volume_gbp": 665_000_000, "avg_line": 5_496 },
      "mortgage": { "count": 17_400, "volume_gbp": 575_000_000, "avg_loan": 33_046 }
    },
    "by_channel": {
      "digital": 0.64, "branch": 0.18, "broker": 0.18
    },
    "trend": [ { "period": "2026-01", "count": 44_200, "volume": 408_000_000 } ]
  },
  "credit_card_ops": {
    "average_credit_limit": 5_496,
    "average_utilisation": 0.382,
    "activation_rate_30d": 0.71,
    "average_apr": 21.99,
    "approval_rate": 0.711,
    "stp_rate": 1.0,
    "average_decision_time_seconds": 1.4
  },
  "mortgage_ops": {
    "pipeline_count": 4_820,
    "pipeline_value_gbp": 1_374_000_000,
    "pipeline_by_stage": {
      "document_collection": 1_240, "valuation": 980, "underwriting": 1_860, "offer_issued": 740
    },
    "average_ltv": 0.728,
    "stp_rate": 0.41,
    "average_time_to_offer_days": 14.3,
    "approval_rate": 0.619,
    "average_dti": 0.382
  },
  "customer_service": {
    "complaint_rate_per_1000": 2.1,
    "ppi_upheld_rate": 0.0,
    "complaints_resolved_within_8_weeks_pct": 0.97,
    "nps_score": 42
  }
}
```

---

#### `GET /api/analytics/risk`

**Query params**: `period`, `product`

**Response (200 OK):**
```json
{
  "portfolio_quality": {
    "total_outstanding_gbp": 6_840_000_000,
    "npl_balance_gbp": 143_640_000,
    "npl_rate": 0.021,
    "ecl_provision_gbp": 198_360_000,
    "provision_coverage_ratio": 1.38,
    "net_charge_off_rate_annualised": 0.028,
    "by_product": {
      "credit_card": { "outstanding": 2_890_000_000, "npl_rate": 0.032, "ecl": 101_100_000 },
      "mortgage": { "outstanding": 3_950_000_000, "npl_rate": 0.008, "ecl": 97_260_000 }
    }
  },
  "dpd_distribution": {
    "current": 0.894,
    "dpd_1_29": 0.058,
    "dpd_30_59": 0.022,
    "dpd_60_89": 0.014,
    "dpd_90_plus": 0.012
  },
  "vintage_curves": [
    {
      "cohort": "2025-01",
      "product_type": "credit_card",
      "data_points": [
        { "months_on_book": 1, "cumulative_default_rate": 0.001 },
        { "months_on_book": 3, "cumulative_default_rate": 0.006 },
        { "months_on_book": 6, "cumulative_default_rate": 0.014 },
        { "months_on_book": 12, "cumulative_default_rate": 0.021 }
      ]
    }
  ],
  "concentration_risk": {
    "top_10_borrower_pct_of_portfolio": 0.0018,
    "geography": {
      "london": 0.31, "south_east": 0.19, "north_west": 0.12, "other": 0.38
    },
    "ltv_bands_mortgage": {
      "under_60": 0.24, "60_to_75": 0.38, "75_to_85": 0.27, "over_85": 0.11
    }
  },
  "stress_indicators": {
    "rate_sensitivity_100bps_nii_impact_gbp": -14_200_000,
    "unemployment_1ppt_npl_impact_bps": 18,
    "house_price_10pct_decline_ltv_breach_count": 2_840
  }
}
```

---

#### `GET /api/analytics/projections`

Uses linear regression on historical `PortfolioSnapshot` data + Monte Carlo (n=10,000 simulations) to generate 12-month forward estimates with confidence intervals.

**Query params**: `horizon` (`12m` | `24m`), `product`, `scenario` (`base` | `stress` | `upside`)

**Response (200 OK):**
```json
{
  "horizon_months": 12,
  "scenario": "base",
  "generated_at": "2026-04-03T08:00:00Z",
  "revenue_projection": {
    "months": [
      {
        "period": "2026-05",
        "net_interest_income_p50": 102_400_000,
        "net_interest_income_p10": 96_800_000,
        "net_interest_income_p90": 108_100_000
      }
    ],
    "year_end_total_p50": 1_248_000_000,
    "year_end_total_p10": 1_164_000_000,
    "year_end_total_p90": 1_332_000_000
  },
  "originations_projection": {
    "months": [ { "period": "2026-05", "volume_p50": 432_000_000, "volume_p10": 398_000_000, "volume_p90": 468_000_000 } ],
    "year_end_total_p50": 5_190_000_000
  },
  "npl_projection": {
    "months": [ { "period": "2026-05", "npl_rate_p50": 0.022, "npl_rate_p10": 0.019, "npl_rate_p90": 0.026 } ],
    "year_end_npl_rate_p50": 0.023
  },
  "plan_comparison": {
    "revenue_plan": 1_290_000_000,
    "revenue_p50_gap_pct": -0.032,
    "npl_plan_ceiling": 0.028,
    "npl_p90_within_plan": true
  },
  "scenario_assumptions": {
    "base": "Bank Rate holds at 4.5%; GDP growth 1.2%; unemployment 4.3%",
    "stress": "Bank Rate rises 100bps; GDP contraction -0.5%; unemployment 5.8%",
    "upside": "Bank Rate cut 50bps; GDP growth 2.1%; unemployment 3.9%"
  }
}
```

#### Projection methodology:

```python
# projections.py — Required implementation detail
#
# Step 1: Fit trend on last 24 months of PortfolioSnapshot (OLS via numpy.polyfit)
# Step 2: Monte Carlo (n=10_000): each simulation draws:
#   - origination_growth from Normal(mean=trend_slope, sigma=historical_volatility)
#   - interest_rate_shock from Normal(0, 0.0025) per month  [25bps annual sigma]
#   - npl_shock from LogNormal(log(base_npl), 0.15)         [fat-tailed credit losses]
# Step 3: Aggregate simulations → p10, p50, p90 percentiles per month
# Step 4: Apply macro scenario overlay (multiplicative factors on growth + loss rates)
#
# All random state seeded at request time with uuid-based seed for reproducibility
# p10/p90 = 10th/90th percentile of simulation distribution (NOT ±1sigma)
# Projections beyond 12 months widen confidence bands by sqrt(t) factor
```

---

#### `GET /api/analytics/corporate`

**Query params**: `period`

**Response (200 OK):**
```json
{
  "people_metrics": {
    "total_headcount": 1_248,
    "headcount_by_function": {
      "technology": 312, "risk_and_compliance": 198, "operations": 284,
      "sales_and_distribution": 214, "finance": 87, "other": 153
    },
    "attrition_rate_annualised": 0.142,
    "revenue_per_fte": 252_804,
    "headcount_trend": [ { "period": "2026-01", "headcount": 1_231 } ]
  },
  "unit_economics": {
    "customer_acquisition_cost": {
      "credit_card": 118, "mortgage": 942, "blended": 224
    },
    "customer_lifetime_value_estimated": {
      "credit_card": 1_840, "mortgage": 18_600, "blended": 4_210
    },
    "ltv_cac_ratio": {
      "credit_card": 15.6, "mortgage": 19.7, "blended": 18.8
    }
  },
  "customer_base": {
    "total_active_customers": 1_284_000,
    "new_customers_period": 42_600,
    "multi_product_customers": 0.14,
    "customer_tenure_avg_months": 28.4,
    "churn_rate_annualised": 0.061
  },
  "regulatory_capital": {
    "cet1_ratio": 0.138,
    "total_capital_ratio": 0.162,
    "leverage_ratio": 0.052,
    "lcr": 1.38,
    "rwa_gbp": 4_820_000_000,
    "regulatory_minimum_cet1": 0.08,
    "buffer_above_minimum_bps": 580
  },
  "nps_and_quality": {
    "nps_overall": 42,
    "nps_credit_card": 38,
    "nps_mortgage": 51,
    "fca_complaint_rate_per_1000": 2.1,
    "complaints_upheld_pct": 0.38
  }
}
```

---

#### `POST /api/analytics/ai-narrative`

Generates a 3-bullet executive brief summarising the current dashboard state.

**Request:**
```json
{
  "period": "mtd",
  "include_sections": ["financial", "operational", "risk"],
  "tone": "board_brief"
}
```

**Response (200 OK):**
```json
{
  "generated_at": "2026-04-03T08:00:00Z",
  "model": "gemini-2.0-flash",
  "brief": {
    "performance_summary": "Revenue YTD of £315.5M is tracking 3% below plan, driven by NIM compression of 18bps MoM as cost of funds rose faster than asset repricing on the fixed-rate mortgage book.",
    "risk_highlights": "NPL rate of 2.1% remains within the 2.8% plan ceiling. Mortgage LTV concentration above 85% increased 1.5pp QoQ — recommend credit policy review before Q2 originations ramp.",
    "strategic_focus": "Credit card STP rate at 100% and 1.4s average decision time are market-leading. Mortgage pipeline conversion rate of 41% STP lags peer benchmark of 55% — the key operational lever for Q2 efficiency improvement."
  },
  "data_snapshot": {
    "nii": 98_700_000,
    "npl_rate": 0.021,
    "originations_volume": 412_000_000
  }
}
```

---

#### `GET /api/analytics/export/pdf`

Generates a board-ready PDF snapshot of the current dashboard view.

**Query params**: `period`, `product`, `sections` (comma-separated: `overview,financial,operational,risk,projections,corporate`)

**Response**: `Content-Type: application/pdf`, attachment download.

**Implementation note**: Use `WeasyPrint` (preferred) or `reportlab`. Render an HTML template with the same KPI data as the dashboard. Include: company logo placeholder, report date, "CONFIDENTIAL — FOR INTERNAL USE ONLY" watermark, page numbers, and footer with data governance statement: *"All figures are indicative. Source: AgentHive Analytics Platform. Data as of [timestamp]."*

---

### 5.5 Caching Strategy

```python
# analytics/service.py
# All analytics endpoints are expensive aggregations — cache aggressively

# Use a TTL decorator (implement in core/cache.py):
# - Overview, Financial, Operational, Risk: 15-minute TTL
# - Projections: 60-minute TTL (Monte Carlo is CPU-intensive)
# - Corporate: 60-minute TTL
# - AI Narrative: 30-minute TTL (LLM cost)
#
# Cache key = f"{endpoint}:{period}:{product}:{user_role}"
# On cache miss: run full aggregation and store result as JSON string
# On cache hit: deserialise and return — no DB query
#
# In demo mode: serve pre-computed fixture JSON (no DB access at all)
```

---

## 7. FRONTEND IMPLEMENTATION GUIDE

### 6.1 Analytics Shell (`/analytics/layout.tsx`)

```typescript
// Layout requirements:
// - Left sidebar (same width + collapse behaviour as /lab/layout.tsx)
// - Sidebar nav links: Overview | Financial | Operational | Risk | Projections | Corporate
// - Top bar:
//     Left:  "Executive Analytics" heading + DataFreshnessTag ("Data as of HH:MM UTC")
//     Right: PeriodPicker + ProductToggle + ExportButton
// - Period and product filter state persisted in URL search params
//     (?period=mtd&product=all) — enables shareable deep links
// - Protected by withAuth HOC + executive role check:
//     if (user.customClaims?.role !== "executive") redirect("/dashboard")
// - Role gate renders a 403 card (not a redirect) if authenticated but wrong role
//     — do NOT silently redirect non-executives; show: "This area requires executive access."
```

### 6.2 `KpiCard.tsx`

```typescript
// Props:
interface KpiCardProps {
  label: string;           // "Net Interest Income"
  value: number;           // 98_700_000
  unit: "GBP" | "%" | "x" | "bps" | "days" | "count" | "ratio";
  formatStyle: "currency" | "percent" | "multiple" | "integer" | "bps" | "days";
  delta: number;           // +0.043 = +4.3%
  deltaLabel: string;      // "vs prior month"
  trend?: number[];        // last 6 data points for sparkline
  alertThreshold?: number; // if value crosses threshold → amber background
  alertDirection: "above" | "below"; // which crossing triggers alert
  size?: "sm" | "md" | "lg";
  tooltip?: string;        // definition shown on hover (e.g. "NIM = NII / Average Earning Assets")
}

// Formatting rules:
// GBP currency: £98.7M (always abbreviated — never raw digits for exec view)
// Percentage: 2.1% (1 decimal place)
// Basis points: 148bps
// Delta: always show sign (▲ +4.3% in green / ▼ -1.8% in red / — 0.0% in grey)
// Alert: amber card border + warning icon when alertThreshold is crossed
//
// Tooltip: show full financial definition on hover (use shadcn Tooltip)
// Sparkline: tiny Recharts LineChart (no axes, no labels) in card footer
```

### 6.3 Overview Page (`/analytics/overview/page.tsx`)

Layout:
1. **Hero KPI row** (`KpiCardGrid` 3-col on desktop, 2-col on tablet, 1-col on mobile):
   - Total Revenue | Net Interest Income | Total Originations Volume | NPL Rate | Approval Rate | ROE
2. **Plan vs Actual progress bars** — each headline KPI shows a horizontal progress bar: `[████████░░] 97% of plan`
3. **Product split** — `BarComparisonChart` side-by-side: Credit Card vs Mortgage for revenue, originations, NPL
4. **AI Brief** — `AiBriefCard` (collapsible, closed by default): 3 bullets from `/api/analytics/ai-narrative`
5. **Top Risks** — small alert cards at bottom (severity colour-coded: red / amber / green)

Auto-refresh every 15 minutes via SWR (`refreshInterval: 900_000`).

### 6.4 Financial Page (`/analytics/financial/page.tsx`)

Layout:
1. **KpiCardGrid** (4-col):
   - NIM | Cost-Income Ratio | ROE | ROA
   - P&L summary cards: Total Revenue | NII | Operating Costs | PBT
2. **Revenue vs Cost of Funds trend** — dual-axis `TrendChart`:
   - Left axis: Revenue, NII (bar series)
   - Right axis: NIM % (line series)
   - 12 months on x-axis
3. **P&L Waterfall** — `WaterfallChart` showing build from gross interest income → PBT
4. **Margin Analysis table** — `HeatmapTable`:
   - Rows: Credit Card, Mortgage, Total
   - Columns: NIM %, Cost of Funds %, Cost-Income Ratio, ROE, ROA
   - Colour coding: above plan = green, at plan = neutral, below plan = red

### 6.5 Operational Page (`/analytics/operational/page.tsx`)

Layout:
1. **Originations KpiCardGrid** — Total Originations £ | Count | YoY Growth | Avg Deal Size
2. **Originations trend** — `TrendChart` last 12 months, broken down by product (stacked bar)
3. **Credit Card Operations panel**:
   - KpiCards: Approval Rate | Avg Credit Limit | Utilisation | Activation Rate 30d | Avg APR
   - Decision speed: large single stat — "⚡ 1.4 seconds average decision time"
4. **Mortgage Pipeline panel**:
   - Pipeline funnel visualisation: Submitted → In Review → Approved → Funded
   - STP Rate gauge (shadcn Progress or Radial chart) — target: 55%
   - `TrendChart`: Time-to-Offer trend vs 14-day target
5. **Channel Mix** — `BarComparisonChart`: Digital | Branch | Broker — originations volume
6. **Customer Service** — NPS trend + complaint rate KpiCards

### 6.6 Risk Page (`/analytics/risk/page.tsx`)

Layout:
1. **Portfolio Quality KpiCardGrid**:
   - Total Outstanding | NPL Rate (with alert at 2.8%) | ECL Provision | Provision Coverage | NCO Rate
2. **NPL trend** — `TrendChart` 12 months — NPL rate line vs 2.8% plan ceiling (dashed red line)
3. **DPD bucket distribution** — horizontal stacked bar (Current | 1-29 | 30-59 | 60-89 | 90+)
4. **Vintage curves** — `VintageCurveChart`:
   - Each cohort (month of origination) plotted as separate line
   - X-axis: months on book (0–24)
   - Y-axis: cumulative default rate
   - Show last 8 cohorts; highlight most recent 3
5. **Concentration risk** — `HeatmapTable`:
   - Rows: LTV bands for mortgages (< 60%, 60–75%, 75–85%, > 85%)
   - Colour: red if > 85% LTV concentration exceeds 10% of portfolio
6. **Stress indicators panel** — 3 KpiCards:
   - Rate sensitivity: "−£14.2M NII per 100bps rate rise"
   - Unemployment sensitivity: "+18bps NPL per 1pp unemployment increase"
   - House price sensitivity: "2,840 breaches at −10% HPI"

### 6.7 Projections Page (`/analytics/projections/page.tsx`)

Layout:
1. **Scenario toggle** — 3-button toggle: Base | Stress | Upside (changes all charts)
2. **Horizon toggle** — 12 months | 24 months
3. **Revenue projection** — `ProjectionBand`:
   - Centre line: p50 projection
   - Shaded band: p10–p90 confidence interval
   - Vertical dashed line at current date
   - Actual historical data shown left of current date (no gap between actual and projected)
4. **Originations projection** — same `ProjectionBand` pattern
5. **NPL projection** — `ProjectionBand` with plan ceiling overlay (horizontal dashed line)
6. **Plan vs Projection table** — right panel:
   ```
   Metric           Plan     P50      Gap      Status
   Revenue (12m)    £1.29B   £1.25B   -3.1%    ⚠ Below plan
   Originations     £5.4B    £5.2B    -3.7%    ⚠ Below plan
   NPL Rate         ≤2.8%    2.3%     +50bps   ✓ Within budget
   Cost-Income      ≤54%     53.4%    +0.6pp   ✓ At plan
   ```
7. **Scenario assumptions panel** — collapsible, shows macro assumptions for each scenario

### 6.8 Corporate Page (`/analytics/corporate/page.tsx`)

Layout in two sections:

**Section A — Unit Economics & Growth**
1. **LTV:CAC ratio** — 3 large stat cards (Credit Card | Mortgage | Blended)
2. **CAC trend** — `TrendChart` 12 months: CAC by product + blended
3. **Customer base** — KpiCards: Total Customers | New Customers | Multi-product % | Churn Rate
4. **NPS trend** — `TrendChart`: Overall | Credit Card | Mortgage NPS over 12 months

**Section B — People & Capital**
1. **People KpiCardGrid**: Total Headcount | Revenue/FTE | Attrition Rate | Open Roles
2. **Headcount by function** — horizontal `BarComparisonChart`
3. **Regulatory Capital ratio cards**:
   - CET1 Ratio (with 8% regulatory minimum marker) — show buffer clearly
   - Total Capital Ratio | Leverage Ratio | LCR
   - Alert if CET1 buffer < 200bps above minimum

---

## 8. AI EXECUTIVE BRIEF FLOW (`executive-brief-flow.ts`)

```typescript
// src/ai/flows/executive-brief-flow.ts
// Genkit server action — called from /analytics/overview page

import { defineFlow, run } from "@genkit-ai/flow";
import { gemini20Flash } from "@genkit-ai/googleai";
import { z } from "zod";

const ExecutiveBriefInputSchema = z.object({
  metrics: z.object({
    revenue_gbp: z.number(),
    nii_gbp: z.number(),
    npl_rate: z.number(),
    nim: z.number(),
    originations_gbp: z.number(),
    cost_income_ratio: z.number(),
    roe: z.number(),
    plan_revenue_attainment: z.number(),
    top_risks: z.array(z.object({ code: z.string(), description: z.string() })),
  }),
  period: z.string(),
  tone: z.enum(["board_brief", "management_review", "daily_standup"]),
});

const ExecutiveBriefOutputSchema = z.object({
  performance_summary: z.string(),
  risk_highlights: z.string(),
  strategic_focus: z.string(),
});

// Prompt requirements:
// - Tone: board_brief = formal, precise, no jargon. 2 sentences max per bullet.
// - Always cite specific numbers with units (£, %, bps)
// - Performance summary: lead with the most important positive or negative variance vs plan
// - Risk highlights: identify the single most material risk + one specific action
// - Strategic focus: one operational improvement opportunity with quantified target
// - NEVER use phrases like "it is important to note" or "in conclusion"
// - Model: gemini20Flash with temperature: 0.2 (low creativity, high accuracy)
```

---

## 9. ROLE-BASED ACCESS IMPLEMENTATION

### Firebase Custom Claims

The `executive` role must be set as a custom claim on the Firebase user:

```typescript
// Backend: set via Firebase Admin SDK (run once per executive user)
// backend/app/core/firebase_admin.py  (ADD)

import firebase_admin
from firebase_admin import auth

async def set_executive_role(uid: str):
    auth.set_custom_user_claims(uid, {"role": "executive"})
```

### Frontend Role Guard (`src/components/analytics/ExecutiveGuard.tsx`)

```typescript
// Wrap every analytics page with this component
export function ExecutiveGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!user) { redirect("/login"); return null; }

  const token = await user.getIdTokenResult(true); // force refresh
  if (token.claims?.role !== "executive") {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Executive Access Required</AlertTitle>
          <AlertDescription>This area is restricted to the executive team. Contact your administrator to request access.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Backend Middleware

```python
# All /api/analytics/* routes use the require_executive_role dependency.
# Never skip the role check even in demo mode — analytics data is price-sensitive.
# In demo_mode=true: serve synthetic data (no DB) but still enforce role.
```

---

## 10. DATA HOOKS (`src/hooks/useAnalytics.ts`)

```typescript
import useSWR from "swr";
import { analyticsApi } from "@/lib/analytics-api";

// Auto-refresh every 15 minutes; show stale data while revalidating (no loading flash)
const REFRESH_INTERVAL = 15 * 60 * 1000;

export function useAnalyticsOverview(period: string, product: string) {
  return useSWR(
    ["analytics-overview", period, product],
    () => analyticsApi.getOverview({ period, product }),
    {
      refreshInterval: REFRESH_INTERVAL,
      keepPreviousData: true,       // No blank screen on period switch
      revalidateOnFocus: false,
      onError: (err) => console.error("[analytics/overview]", err),
    }
  );
}

// Repeat pattern for: useAnalyticsFinancial, useAnalyticsOperational,
//                     useAnalyticsRisk, useAnalyticsProjections, useAnalyticsCorporate
//
// Each hook also returns:
//   data: <typed response>
//   isLoading: boolean (true ONLY on first load — not on revalidation)
//   isValidating: boolean (true during background revalidation)
//   error: Error | undefined
//   mutate: () => void  (manual refresh trigger for ExportButton)
```

---

## 11. NAVIGATION INTEGRATION

Add `/analytics` to the existing global navigation in `src/app/dashboard/page.tsx` and the top-level layout. The link should only render if the user has the `executive` role (check custom claims). Non-executive users must not see the nav entry — do not rely on route protection alone to hide the link.

```typescript
// src/app/layout.tsx or dashboard nav component — ADD conditionally:
{user?.customClaims?.role === "executive" && (
  <NavigationMenuLink href="/analytics">
    <BarChart3 className="w-4 h-4" />
    Executive Analytics
  </NavigationMenuLink>
)}
```

---

## 12. DEMO MODE BEHAVIOUR

The analytics module supports two modes controlled by `?demo=true` or `DemoModeToggle`:

- **Backend** (`demo_mode=true`): Sets `CC_USE_PARQUET_FALLBACK=true` and `BQ_USE_PARQUET_FALLBACK=true` for the duration of the request. The adapters load from:
  - `credit-risk-platform/data/raw/cc_pd/origination_5m.parquet` (credit cards)
  - `credit-risk-platform/data/raw/loan_applications.parquet` (loans)
  - `credit-risk-platform/data/raw/cc_pd/pd_training_5m.parquet` (PD scores)
  - `credit-risk-platform/data/raw/cc_pd/txn_summary_5m.parquet` (transactions)
  - `credit-risk-platform/data/raw/cc_pd/cost_assumptions.parquet` (cost assumptions)
  
  The response includes `"data_availability": "demo"` and `"data_source": "parquet"` in the metadata.

- **Frontend**: A yellow banner is shown at the top of every analytics page: `"⚠ Demo Mode — Showing pre-loaded data from credit-risk-platform sample datasets. No live queries are made."`
- **AI Brief**: In demo mode, the AI brief is generated from real Parquet-derived aggregates (not canned text); the `AiBriefCard` shows a "Sample Data" badge.
- **Export**: PDF export in demo mode includes a watermark: `SAMPLE DATA — CREDIT-RISK-PLATFORM SYNTHETIC DATASET — NOT FOR DISTRIBUTION`.

---

## 13. TESTING REQUIREMENTS

### Backend (`backend/tests/test_analytics.py`)

```python
# Required test cases:

# ── Data Adapters (concrete, not mocked) ─────────────────────────────────────
# 1.  cc_adapter: load_cc_accounts() returns DataFrame with required CC_ACCOUNTS_COLUMNS
# 2.  cc_adapter: load_cc_pd_scores() — default_flag values are 0 or 1 only
# 3.  cc_adapter: load_cc_txn_summary() — no negative interest_charged values
# 4.  bq_adapter: load_loan_applications() — Parquet fallback returns expected columns
# 5.  bq_adapter: When BQ_USE_PARQUET_FALLBACK=true, no BigQuery call is made (assert client not called)
# 6.  cc_adapter: date_from / date_to filtering reduces row count vs unfiltered

# ── Aggregator ────────────────────────────────────────────────────────────────
# 7.  compute_cc_kpis: returns npl_rate in [0, 1]
# 8.  compute_cc_kpis: nii = interest_income - cost_of_funds within £1K tolerance
# 9.  compute_loan_kpis: approval_rate in [0, 1]
# 10. compute_loan_kpis: average_loan_size > 0 when originations_volume > 0
# 11. aggregator: all None fields (missing source) surface in affected_kpis list
# 12. period resolution: 'mtd' start date == first day of current month

# ── API endpoints ─────────────────────────────────────────────────────────────
# 13. All endpoints return 403 for non-executive roles
# 14. All endpoints return 200 with correctly typed response for executive role
# 15. Period parameter variations (mtd, qtd, ytd, last_30, custom) all resolve
# 16. Product filter (all, credit_card, mortgage) returns different data subsets
# 17. data_availability field is present in every response
# 18. Parquet-fallback mode: affected_kpis in response when BQ unavailable

# ── Projections ────────────────────────────────────────────────────────────────
# 19. p10 < p50 < p90 for all months (sanity check — not just one period)
# 20. Projection input is derived from real aggregator output, not hardcoded

# ── Export & AI ────────────────────────────────────────────────────────────────
# 21. Export endpoint returns Content-Type: application/pdf
# 22. AI narrative prompt contains real aggregated KPI values (not placeholder)
# 23. AI narrative handles LLM timeout gracefully (fallback canned message)

# ── Financial identity ─────────────────────────────────────────────────────────
# 24. NIM = NII / total_balance within 2bps tolerance
# 25. Total revenue = interest_income + fee_income (no rounding gap > £1k)
```

### Frontend
- Unit test `KpiCard` rendering with all formatStyle variants
- Unit test `ProjectionBand` renders confidence interval shading at correct percentiles
- Unit test `ExecutiveGuard` — renders 403 card for non-executive user, renders children for executive
- Integration test: period picker URL param change triggers SWR revalidation

---

## 14. DEPENDENCY ADDITIONS

Add to `backend/requirements.txt` (extend existing):
```
# Analytics module additions
google-cloud-bigquery>=3.11.0
google-cloud-bigquery-storage>=2.24.0   # faster BQ reads via Arrow
pyarrow>=14.0.0                          # Parquet + BQ arrow transport
WeasyPrint>=60.0                         # PDF export
numpy>=1.26.0                            # Projections engine
scipy>=1.12.0                            # Monte Carlo
faker>=24.0.0                            # Only if running data generators locally
```

The `google-cloud-bigquery` package uses the **existing** `GCS_SA_KEY.json` from `credit-risk-platform/data/GCS_SA_KEY.json`. Copy the path into `GOOGLE_APPLICATION_CREDENTIALS` env var — do not copy the file itself into the AgentHiveHQ repo.

---

## 15. PERFORMANCE REQUIREMENTS

| Metric | Target |
|---|---|
| Overview page initial load (cached) | < 800ms |
| Overview page initial load (cold) | < 2,500ms |
| Chart render (12 series × 24 points) | < 100ms |
| SWR background revalidation — no visible rerender | Required |
| PDF export generation | < 5 seconds |
| All analytics endpoints P95 latency | < 300ms (cached) |

---

## 16. FINANCIAL METRIC DEFINITIONS

Every KPI must use the standard financial services definition listed here. Do not invent definitions.

| KPI | Formula | Notes |
|---|---|---|
| **NIM** | Net Interest Income / Average Earning Assets | Earning assets = interest-bearing loan balances only |
| **NII** | Interest Income − Cost of Funds | Excludes fee income (separate line item) |
| **ROE** | Net Income After Tax / Average Equity | Annualised |
| **ROA** | Net Income After Tax / Average Total Assets | Annualised |
| **NPL Rate** | Non-Performing Loans Balance / Total Loan Balance | NPL = DPD 90+ |
| **Provision Coverage Ratio** | ECL Provision / NPL Balance | > 1.0 means over-provisioned |
| **Cost-Income Ratio** | Operating Costs / Total Income (NII + Fee Income) | Lower is better; 50–55% is typical for retail banks |
| **STP Rate** | Applications processed without human intervention / Total Applications | Higher = more automated |
| **LTV** | Outstanding Loan Balance / Property Value | Mortgage only |
| **DPD** | Days Past Due on scheduled repayment | — |
| **CET1** | Common Equity Tier 1 Capital / Risk-Weighted Assets | Regulatory minimum 8%; buffer ≥ 200bps expected |
| **LCR** | High-Quality Liquid Assets / Net Cash Outflows (30-day stress) | Minimum 1.0 (100%) |
| **CAC** | Total Acquisition Cost / New Customers Acquired | Includes marketing + processing + broker fees |
| **LTV:CAC** | Customer Lifetime Value / CAC | > 3× is healthy; > 10× is excellent for lending |
| **NPS** | % Promoters − % Detractors | −100 to +100; 40+ is good for financial services |

All KPI tooltips in `KpiCard.tsx` must display the formula from this table verbatim.

---

## 17. QUALITY GATES

Before considering /analytics complete, all the following must pass:

```
CODE QUALITY
[ ] TypeScript strict mode — zero `any` types in analytics/ components and hooks
[ ] All Pydantic schemas have field-level docstrings (used for OpenAPI docs)
[ ] All Recharts charts are responsive (ResponsiveContainer wrapping all chart components)
[ ] All number formatting uses Intl.NumberFormat — never template literals for currency

UI/UX
[ ] PeriodPicker and ProductToggle state survives page navigation (URL params, not state)
[ ] KpiCard alerts fire at correct thresholds (NPL > 2.8%, CET1 buffer < 200bps, NIM < 1.0%)
[ ] Mobile layout tested — KpiCardGrid collapses to 1-col, sidebar to drawer
[ ] All charts have accessible ARIA labels and keyboard-navigable legends
[ ] CONFIDENTIAL label visible on every analytics page (small text, top-right of content area)

DATA INTEGRITY
[ ] Synthetic data generator produces same values on same random seed
[ ] All currency values rendered in GBP with explicit £ symbol — never bare numbers
[ ] Period labels match the selected period filter on every chart
[ ] "Data as of" timestamp updates correctly after SWR revalidation

SECURITY
[ ] Executive role enforced on every route and every API endpoint independently
[ ] No analytics data appears in browser DevTools Network tab for non-executive users
[ ] PDF export includes data governance footer on every page
[ ] AI narrative prompt does not include raw customer PII (only aggregated metrics)

TESTING
[ ] All backend test cases from Section 12 pass
[ ] PDF export tested manually — opens in browser and renders correctly
[ ] Demo mode banner appears and synthetic data is visually reasonable
```

---

## 18. STANDALONE REQUEST — 5M CUSTOMER ROW-LEVEL SYNTHETIC DATASET (10-YEAR HISTORY)

> **Scope**: This is a fully independent data engineering task. It does not depend on any other section of this prompt. The output is a self-contained set of Parquet files that serve as the analytics base layer for both the `/analytics` dashboard and standalone model training workloads.

### 18.1 Objective

Generate **5,000,000 unique customer records** with complete row-level origination snapshots and linked transactional history spanning **10 years (2015-01-01 → 2024-12-31)**. The distributions must closely mimic those observed in large US/UK retail bank portfolios (JPMorgan Chase, Bank of America, Barclays, Lloyds).

Every record must be **deterministic on a fixed seed** (default seed=42) to ensure reproducibility across runs.

---

### 18.2 Output File Structure

All files written to `data/raw/synthetic_bank/`. Compression: **Snappy Parquet**.

```
data/raw/synthetic_bank/
├── dim_customer.parquet              # 5M rows — customer master / demographics
├── dim_product.parquet               # ~120 rows — product catalogue
├── fact_origination.parquet          # 5–8M rows — one row per account opened (customers can hold multiple)
├── fact_transaction.parquet/         # partitioned by year — ~800M–1.2B rows total
│   ├── year=2015/part-0000.parquet
│   ├── year=2016/part-0000.parquet
│   │   …
│   └── year=2024/part-0000.parquet
├── fact_monthly_statement.parquet    # ~210M rows — monthly balance/payment snapshots per account
├── fact_credit_event.parquet         # ~18M rows — delinquency, default, cure, charge-off events
├── fact_limit_change.parquet         # ~12M rows — credit limit increase/decrease events
├── fact_product_switch.parquet       # ~3M rows — product upgrades/downgrades
└── manifest.json                     # Row counts, schema version, generation timestamp, seed
```

> **RAM strategy**: All generation is fully vectorised (NumPy/Pandas). Transactions are generated and written year-by-year to disk; never materialise all 1B+ rows in RAM simultaneously. Peak RAM target: ≤ 8 GB.

---

### 18.3 Demographic & Product Distributions — Big Bank Calibration

#### Customer Demographics (`dim_customer`)

| Attribute | Distribution | Source benchmark |
|---|---|---|
| **Age at origination** | Normal(μ=42, σ=13), clipped [18, 85] | US Census / FRB SCF 2022 |
| **Gender** | 51% Female, 48% Male, 1% Non-binary/Unknown | FDIC 2023 |
| **Annual income** | Log-normal(μ=ln(58,000), σ=0.72), min $12k, max $5M | Fed SCF 2022 |
| **Employment status** | 68% Full-time, 12% Part-time, 8% Self-employed, 7% Retired, 3% Unemployed, 2% Student | BLS 2023 |
| **State distribution** | Population-weighted (CA 8.9%, TX 8.1%, FL 6.7%, NY 5.9% …) | US Census 2020 |
| **FICO score** | Mixture of 5 components (see below) | Experian State of Credit 2023 |
| **Homeownership** | 65% Owner, 35% Renter | US Census 2023 |
| **Number of dependants** | Poisson(λ=0.9), max 8 | ACS 2022 |
| **Median household income (census tract proxy)** | Correlated with state + income (r≈0.60) | ACS 2022 |

**FICO mixture model** (calibrated to 2023 Experian national distribution):

| Segment | FICO Band | Population Share | Normal(μ, σ) |
|---|---|---|---|
| Super-Prime | 781–850 | 23% | N(820, 18) |
| Prime-Plus | 740–780 | 13% | N(760, 12) |
| Prime | 670–739 | 27% | N(705, 20) |
| Near-Prime | 580–669 | 20% | N(625, 25) |
| Sub-Prime | 300–579 | 17% | N(490, 45) |

#### Product Catalogue (`dim_product`) — 7 Credit Card Tiers + 4 Mortgage Products

**Credit Card Products** (mimics Chase/BofA/Citi/Barclays lineup):

| Product Code | Name | Annual Fee | APR Range | Reward Rate | Min FICO | Target Segment | Market Share |
|---|---|---|---|---|---|---|---|
| `CC_SECURED` | Secured Starter | $35 | 24.99–27.99% | 0% | 300 | Sub-prime / credit-builder | 6% |
| `CC_STUDENT` | Student Flex | $0 | 19.99–22.99% | 1% cashback | 600 | 18–25, thin file | 8% |
| `CC_EVERYDAY` | Everyday Cash | $0 | 18.99–21.99% | 1.5% cashback | 640 | Mass market prime | 22% |
| `CC_REWARDS` | Rewards Plus | $95 | 18.24–21.24% | 2× points | 680 | Engaged prime | 28% |
| `CC_TRAVEL` | Travel Elite | $250 | 17.99–20.99% | 3× travel | 720 | Affluent prime-plus | 18% |
| `CC_ULTRA` | Prestige Reserve | $550 | 16.99–18.99% | 5× travel + lounge | 760 | HNW super-prime | 5% |
| `CC_BUSINESS` | Business Edge | $95 | 17.99–20.99% | 2× business | 660 | SME / business owners | 13% |

**Mortgage Products** (mimics Freddie Mac / Fannie Mae / Barclays Residential):

| Product Code | Name | LTV Band | Rate Type | Typical Rate | Term | Market Share |
|---|---|---|---|---|---|---|
| `MTG_FRM30` | 30yr Fixed | ≤97% LTV | Fixed | 6.50–7.50% | 360m | 48% |
| `MTG_FRM15` | 15yr Fixed | ≤90% LTV | Fixed | 5.90–6.90% | 180m | 19% |
| `MTG_ARM5` | 5/1 ARM | ≤95% LTV | Variable (5yr fixed then annual) | 5.75–6.50% | 360m | 21% |
| `MTG_HELOC` | HELOC | ≤80% CLTV | Variable (Prime + spread) | Prime+1.5% | 120m + 240m | 12% |

---

### 18.4 Origination Rules (`fact_origination`)

**Volume calibration** (mimics a mid-to-large US bank 2015–2024):

| Year | CC Originations | Mortgage Originations | Notes |
|---|---|---|---|
| 2015 | 380,000 | 52,000 | Base year |
| 2016 | 410,000 | 58,000 | +8% growth |
| 2017 | 445,000 | 61,000 | Moderate growth |
| 2018 | 430,000 | 55,000 | Rising rate headwind (Fed funds 2.25%) |
| 2019 | 462,000 | 63,000 | Rate cut tailwind |
| 2020 | 310,000 | 48,000 | COVID shock — originations down 33% |
| 2021 | 490,000 | 89,000 | Rebound + refi boom (rates at 0%) |
| 2022 | 520,000 | 58,000 | CC growth; mortgage rate shock (6%+) |
| 2023 | 510,000 | 42,000 | Sustained high rates |
| 2024 | 495,000 | 45,000 | Mild cooling |

**One customer can hold multiple accounts** (avg 1.4 CC accounts; 8% hold a mortgage). Product assignment is FICO-gated per catalogue above.

**Key origination fields**:
```
account_id          UUID
customer_id         FK → dim_customer
product_code        FK → dim_product
orig_date           DATE — drawn from annual volume targets above
channel             online(52%) / branch(20%) / phone(12%) / mail(6%) / broker(10%)
credit_limit        INT  — CC: product-bounded, income/FICO-driven (see Section 18.5)
loan_amount         DECIMAL — mortgages only
property_value      DECIMAL — mortgages only
ltv_ratio           DECIMAL — mortgages only
approved_rate       DECIMAL — APR (CC) or note rate (mortgage)
risk_grade          ENUM(Super-Prime, Prime-Plus, Prime, Near-Prime, Sub-Prime)
acquisition_cost    DECIMAL — channel-dependent (online=$45, branch=$120, phone=$95, mail=$150, broker=$180)
account_status      ENUM(active, suspended, closed, charged_off, fraud_hold) — evolves over time
close_date          DATE nullable
months_on_book      INT — derived at query time
```

---

### 18.5 Credit Limit & Mortgage Amount Assignment

**Credit card credit limit**:
```
base_income_multiple = 0.15 × (fico / 850) + 0.05 × (income / 80,000)
raw_cl = annual_income × base_income_multiple
fico_multiplier = 0.70 + 0.50 × (fico − 580) / 270          # 0.70 @ FICO 580 → 1.20 @ 850
pd_haircut = 1.0 − 0.50 × (pd_score / product.pd_hard_decline)
credit_limit = clip(raw_cl × fico_multiplier × pd_haircut, product.cl_min, product.cl_max)
credit_limit = round(credit_limit / 100) × 100               # round to nearest $100
```

**Mortgage loan amount**:
```
dti_cap = 0.43 (QM rule)
max_payment = monthly_income × dti_cap − existing_monthly_obligations
loan_amount = max_payment × annuity_factor(rate, term)
property_value = loan_amount / ltv_ratio
ltv_ratio ~ Beta(α=3.5, β=1.5) × 0.40 + 0.50             # distribution 50–90% LTV
```

---

### 18.6 Transaction Generation (`fact_transaction`)

Generate transactions year-by-year. For each active CC account in a given year:

**Monthly transaction volume per account** (calibrated to US Fed Payment Study 2023):

| Product Tier | Avg txns/month | Avg spend/month | Cash advance rate |
|---|---|---|---|
| Secured | 8 | $320 | 12% of accounts |
| Student | 14 | $480 | 4% |
| Everyday | 22 | $1,050 | 3% |
| Rewards | 28 | $1,840 | 2% |
| Travel | 35 | $3,200 | 1% |
| Prestige | 42 | $6,800 | 0.5% |
| Business | 48 | $9,400 | 5% |

**Transaction type mix** (mimics Nilson Report 2023):

| Type | Share | Amount distribution |
|---|---|---|
| `purchase` | 73% | Log-normal(μ=ln(65), σ=1.1) |
| `payment` | 19% | Varies by balance (≥ min payment = 2% balance) |
| `cash_advance` | 1.5% | Uniform($100, $800) |
| `balance_transfer` | 1.2% | Uniform($500, $5,000) |
| `refund` | 2.8% | 60% of a prior purchase amount |
| `fee` | 1.2% | Late fee $27/$38/$40 or annual fee |
| `interest_charge` | 1.1% | Derived: balance × APR/12 |
| `adjustment` | 0.2% | Small corrections |

**Transaction categories** (distribution calibrated to Visa/Mastercard spend data 2023):

| Category | Share | Notes |
|---|---|---|
| Groceries | 11% | Kroger, Walmart, Whole Foods, Safeway |
| Restaurants | 12% | McDonald's, Starbucks, DoorDash |
| Gas & auto | 6% | Shell, BP, Chevron, AutoZone |
| Travel (airlines) | 5% | Delta, United, American, Southwest |
| Travel (hotels) | 4% | Marriott, Hilton, Hyatt, Airbnb |
| Rideshare / transport | 4% | Uber, Lyft |
| Shopping / retail | 13% | Amazon, Target, Best Buy, Macy's |
| Healthcare | 5% | CVS, Walgreens, hospitals |
| Utilities | 5% | Electric, gas, water, telecom |
| Streaming / subscriptions | 6% | Netflix, Spotify, Apple, Disney+ |
| Entertainment | 4% | Cinemas, concerts, gaming |
| Education | 3% | Tuition, books |
| Home & garden | 4% | Home Depot, Lowe's, IKEA |
| Other | 18% | Long tail |

**Mortgage transactions**: Monthly principal + interest payment only (no purchase history).

**Key transaction fields**:
```
transaction_id      UUID
account_id          FK → fact_origination
customer_id         FK → dim_customer
txn_date            DATE
txn_type            ENUM (purchase/payment/cash_advance/balance_transfer/refund/fee/interest_charge/adjustment)
amount              DECIMAL(12,2) — positive = debit to balance, negative = credit
category            VARCHAR
merchant_name       VARCHAR
merchant_state      VARCHAR
entry_mode          ENUM (chip/contactless/online/swipe/manual/token)
is_foreign          BOOL — 3% of purchases
is_fraud            BOOL — 0.08% base rate; higher for cash advance, online, new accounts
```

---

### 18.7 Monthly Statement (`fact_monthly_statement`)

One row per account per month the account was open. Derived from transaction aggregates.

```
account_id
statement_month         DATE (last day of month)
opening_balance         DECIMAL
closing_balance         DECIMAL
credit_limit            DECIMAL  — limit at statement date (may have changed)
available_credit        DECIMAL  — credit_limit − closing_balance
min_payment_due         DECIMAL  — max(25, 2% × closing_balance)
payment_received        DECIMAL  — sum of payments in the statement cycle
interest_charged        DECIMAL  — closing_balance_prev × APR/12 × (1 − transactor_flag)
fees_charged            DECIMAL  — late fee + annual fee proration
total_spend             DECIMAL  — sum of purchases + cash advances
num_transactions        INT
days_past_due           INT      — 0/30/60/90/120+
utilisation             DECIMAL  — closing_balance / credit_limit
autopay_active          BOOL
```

---

### 18.8 Credit Events (`fact_credit_event`)

Track the full delinquency lifecycle per account.

| Event Type | Trigger | Approx frequency |
|---|---|---|
| `first_missed_payment` | Payment missed ≥ 1 day | ~8% of accounts per year |
| `30dpd` | 30 days past due | ~5% of CC accounts per year |
| `60dpd` | 60 DPD | ~3% |
| `90dpd` | 90 DPD — NPL classification | ~2% |
| `120dpd` | 120 DPD — charge-off candidate | ~1.5% |
| `charge_off` | Issuer writes off balance | ~1.2% per year (CC); 0.08% (MTG) |
| `cure` | Account becomes current after delinquency | ~40% of 30dpd accounts cure |
| `collections_transfer` | Transferred to 3rd-party collections | Subset of charge-off |
| `recovery_payment` | Post charge-off cash recovery | ~20% of charge-off balance recovered over 3 years |
| `bankruptcy_filing` | Customer files Ch.7/Ch.13 | ~0.4% of customers per year |
| `fraud_confirmed` | Fraud investigation concluded | ~0.06% of accounts |

```
event_id            UUID
account_id          FK
customer_id         FK
event_date          DATE
event_type          ENUM (see above)
balance_at_event    DECIMAL
dpd_at_event        INT
recovery_amount     DECIMAL nullable
notes               VARCHAR nullable
```

---

### 18.9 Temporal Dynamics & Macroeconomic Shocks

The generator must embed realistic time-varying behaviour:

| Period | Macro Shock | Implementation |
|---|---|---|
| 2020 Q1–Q2 | COVID: unemployment spike +4ppt, spend collapse −35% | Multiply spend by 0.65; PD × 1.8; originations × 0.60 |
| 2020 Q3–Q4 | Stimulus recovery: spend rebounds | Spend multiplier recovers to 0.95 by Dec-2020 |
| 2021 | Low-rate refi boom: mortgage originations +48% | Volume uplift per table in 18.4 |
| 2022 | Rate shock: Fed funds 0→4.5%; NIM expansion, mortgage collapse | APR reprices +250bps; mortgage originations −35% |
| 2023 | Persistent inflation: revolve rate increases | Utilisation × 1.12; missed payments × 1.10 |
| 2024 | Soft landing: mild normalisation | Revert 80% of stress multipliers |

**Seasonal patterns** (monthly multipliers applied to spend):
```python
MONTHLY_SPEND_MULT = {
    1: 0.82,  # Jan — post-holiday hangover
    2: 0.85,  3: 0.92,  4: 0.95,  5: 1.00,  6: 1.02,
    7: 1.03,  8: 1.04,  # Back to school
    9: 0.98, 10: 1.00, 11: 1.08,  # Pre-holiday
   12: 1.38,  # December — holiday peak
}
```

---

### 18.10 Generator Implementation Spec

**File**: `data/generate_synthetic_bank_10yr.py`

**Entry point**:
```bash
python data/generate_synthetic_bank_10yr.py \
    [--customers 5_000_000] \
    [--seed 42] \
    [--start-year 2015] \
    [--end-year 2024] \
    [--chunk-customers 250_000] \
    [--txn-chunk-months 3] \
    [--out-dir data/raw/synthetic_bank] \
    [--no-transactions]           # skip transaction generation for fast dim/fact only
```

**Required implementation patterns**:

1. **Chunked customer generation** — process `--chunk-customers` at a time (default 250k). Each chunk seeds the next RNG deterministically: `chunk_rng = np.random.default_rng(seed + chunk_idx * 1_000)`.

2. **Yearly transaction loop** — for each year iterate over active accounts; generate monthly spend totals vectorised, then expand to individual transactions using a Poisson draw for count × log-normal draw for amounts.

3. **Account lifecycle** — for each month, move account through state machine:
   ```
   active → missed_payment (p=monthly_pd/12) → 30dpd → 60dpd → 90dpd → charge_off
          ↘ cure (p=0.40 from 30dpd, 0.25 from 60dpd, 0.10 from 90dpd)
          ↘ closed (voluntary, p=0.005/month for active accounts)
   ```

4. **Parquet partitioning** — transactions written with `pyarrow.parquet.write_to_dataset(..., partition_cols=["year"])` to enable year-level partition pruning in Spark / BigQuery.

5. **Manifest** — at completion write `manifest.json`:
   ```json
   {
     "schema_version": "v1.0",
     "seed": 42,
     "generated_at": "2026-04-03T...",
     "customers": 5000000,
     "date_range": ["2015-01-01", "2024-12-31"],
     "row_counts": {
       "dim_customer": 5000000,
       "dim_product": 120,
       "fact_origination": 7284000,
       "fact_transaction_total": 918400000,
       "fact_monthly_statement": 209100000,
       "fact_credit_event": 17820000,
       "fact_limit_change": 11930000,
       "fact_product_switch": 2940000
     },
     "file_sizes_mb": {},
     "default_rate_cc": 0.0182,
     "default_rate_mtg": 0.0008,
     "approval_rate_cc": 0.691,
     "approval_rate_mtg": 0.621
   }
   ```

---

### 18.11 Analytics Usage — How Downstream Systems Consume This Dataset

| Consumer | Files Used | Query Pattern |
|---|---|---|
| **Analytics dashboard** (`/analytics`) | `dim_customer`, `fact_origination`, `fact_monthly_statement` | Monthly aggregates → `PortfolioSnapshot` table |
| **PD model training** | `fact_origination` + `fact_credit_event` + `fact_monthly_statement` | 12-month observation window → 12-month performance window |
| **Vintage analysis** | `fact_origination` + `fact_credit_event` | GROUP BY orig_date (month), months_on_book |
| **Roll-rate / DPD migration** | `fact_monthly_statement` | Month-over-month DPD state transitions |
| **Fraud model** | `fact_transaction` (partitioned) | Labelled by `is_fraud` + temporal features |
| **LTV:CAC** | `dim_customer` + `fact_origination` + `fact_monthly_statement` | CLV = NPV(revenue stream); CAC from `acquisition_cost` |
| **Stress testing** | `fact_monthly_statement` + macro shock multipliers | Scenario application to current balance distribution |
| **Regulatory reporting** | All facts | CCAR / DFAST — 9-quarter stress projection |

---

### 18.12 GCS Upload (`scripts/upload_synthetic_bank_to_gcs.py`)

After local generation, upload all output files to GCS as the analytics base layer.

**GCS layout**:
```
gs://{GCS_BUCKET}/data/synthetic_bank/
├── dim_customer.parquet
├── dim_product.parquet
├── fact_origination.parquet
├── fact_monthly_statement.parquet
├── fact_credit_event.parquet
├── fact_limit_change.parquet
├── fact_product_switch.parquet
├── fact_transaction/
│   ├── year=2015/part-0000.parquet
│   │   …
│   └── year=2024/part-0000.parquet
└── manifest.json
```

**Upload script responsibilities**:
1. Re-use `google.cloud.storage` client (existing in `requirements.txt`)
2. Upload all files from `--local-dir` (default `data/raw/synthetic_bank/`)
3. Parallel uploads using `ThreadPoolExecutor(max_workers=8)`
4. Verify blob MD5 checksum after each upload
5. Print upload manifest with file sizes and GCS URIs
6. Create BigQuery external tables pointing at GCS paths (using existing `bigquery_client.py`):

```sql
-- Auto-created after upload:
CREATE OR REPLACE EXTERNAL TABLE `{project}.{dataset}.synthetic_bank_originations`
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://{bucket}/data/synthetic_bank/fact_origination.parquet']
);

CREATE OR REPLACE EXTERNAL TABLE `{project}.{dataset}.synthetic_bank_transactions`
OPTIONS (
  format = 'PARQUET',
  uris = ['gs://{bucket}/data/synthetic_bank/fact_transaction/year=*/part-*.parquet'],
  hive_partition_uri_prefix = 'gs://{bucket}/data/synthetic_bank/fact_transaction'
);
-- (repeat for all fact tables)
```

**CLI**:
```bash
python scripts/upload_synthetic_bank_to_gcs.py \
    --bucket my-credit-risk-bucket \
    --project ai-risk-workflow \
    --dataset credit_risk_model_dev \
    --local-dir data/raw/synthetic_bank \
    --create-bq-tables
```

---

### 18.13 Validation Checks (run automatically post-generation)

The generator must run these assertions before writing any file and print a `[PASS]` / `[FAIL]` table:

| Check | Target |
|---|---|
| Total customer count | == --customers (default 5,000,000) |
| Date range coverage | Jan 2015 – Dec 2024 (inclusive) |
| CC origination volume by year | Within ±5% of targets in Section 18.4 |
| Mortgage origination volume by year | Within ±5% of targets in Section 18.4 |
| Overall CC charge-off rate (10yr avg) | 1.2% – 2.2% |
| Overall mortgage default rate | 0.05% – 0.20% |
| FICO distribution — % Super-Prime | 20% – 26% |
| FICO distribution — % Sub-Prime | 14% – 20% |
| Average CC credit limit | $5,000 – $12,000 |
| Average mortgage LTV | 65% – 80% |
| December spend multiple vs January | 1.50x – 1.75x |
| COVID 2020 Q2 spend vs 2019 Q2 | 55% – 75% of 2019 levels |
| No null values in required key columns | account_id, customer_id, txn_date, amount |
| Referential integrity | All fact account_ids exist in dim_customer |
| Manifest row counts match actual Parquet | Exact match |
