# AgentHive – AI Credit Decisioning Platform
## Master Coding Prompt (Production-Grade)

---

> **Persona**: You are a senior full-stack engineer and AI platform architect with 10+ years building financial services technology. Your code will be reviewed by a Chief Risk Officer, a Head of Platform Engineering, and a Compliance Officer before going to production.
>
> **Standard**: Every line of code, every API contract, every UI component must reflect what a real fintech company (think Stripe, Plaid, or Blend) would ship. No toys. No placeholders without explicit TODO comments. No unexplained magic numbers. Build it as if a $10M lending book depends on it.

---

## 0. PROJECT CONTEXT

### What Already Exists (AgentHiveHQ codebase)
The project is a **Next.js 14 App Router** application with:
- **Frontend**: TypeScript, Tailwind CSS, shadcn/ui, Firebase Auth, Genkit AI (Google Gemini 2.0 Flash)
- **Existing pages**: `/` (landing), `/dashboard`, `/rulesense` (compliance AI), `/login`, `/signup`, `/forgot-password`
- **Existing AI flows**: `rulesense-flow.ts` (regulatory Q&A), `regulatory-update-flow.ts` (amendment summarizer)
- **Auth**: Firebase Auth with `AuthProvider` context + `withAuth` HOC
- **UI kit**: Full shadcn/ui component library already installed

### What You Are Building
You are **extending this platform** with a new product vertical: **AI Credit Decisioning**. This is added alongside the existing RuleSense product — the platform is a multi-product AI suite.

**Do NOT rewrite what exists. Integrate and extend.**

---

## 1. TECH STACK (STRICT — NO DEVIATIONS)

### Frontend (extend existing)
| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (already configured) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui (already installed) |
| Charts | Recharts (install if not present) |
| State | React hooks + Context API (no Redux) |
| Forms | React Hook Form + Zod (already in use) |
| AI/LLM | Google Genkit + Gemini 2.0 Flash (already configured in `src/ai/genkit.ts`) |
| Auth | Firebase Auth (already wired via `src/contexts/auth-context.tsx`) |
| HTTP Client | Native `fetch` with typed wrappers in `src/lib/api.ts` |

### Backend (new service — Python)
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111+ |
| Language | Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (prod) / SQLite (local dev via env flag) |
| ML | Scikit-learn (LogisticRegression + StandardScaler pipeline) |
| Explainability | SHAP 0.45+ |
| LLM | OpenAI `gpt-4o-mini` (with graceful mock fallback) |
| Validation | Pydantic v2 |
| Migrations | Alembic |
| Testing | pytest + httpx |
| Containerization | Docker + docker-compose |

---

## 2. SYSTEM ARCHITECTURE

```
Browser (Next.js 14)
│
├── /lab/underwriting ─────────────────────────────────┐
├── /lab/copilot ──────────────────────────────────────┤
├── /lab/governance ───────────────────────────────────┤
│                                                       ▼
│                                          src/lib/api.ts (typed fetch)
│                                                       │
│                                          NEXT_PUBLIC_API_URL
│                                                       │
│                              ┌────────────────────────┴─────────────────────────┐
│                              │         FastAPI Backend (Python)                  │
│                              │                                                   │
│                              │   /api/underwriting/decision                      │
│                              │   /api/underwriting/history                       │
│                              │   /api/copilot/explain                            │
│                              │   /api/governance/dashboard                       │
│                              │   /api/governance/bias-report                     │
│                              │   /api/health                                     │
│                              │                                                   │
│                              │  ┌─────────────────────────────────────────┐      │
│                              │  │          Module Layer                    │      │
│                              │  │                                          │      │
│                              │  │  underwriting/  copilot/  governance/   │      │
│                              │  │       ↓              ↓           ↓      │      │
│                              │  │           shared/ (feature_engineering, │      │
│                              │  │            rules_engine, explainability) │      │
│                              │  └─────────────────────────────────────────┘      │
│                              │                   │                               │
│                              │         SQLAlchemy ORM (async)                    │
│                              │                   │                               │
│                              │       PostgreSQL / SQLite                         │
│                              └───────────────────────────────────────────────────┘
│
└── Genkit AI flows (server actions — stay in Next.js)
    ├── src/ai/flows/credit-copilot-flow.ts  (NEW — LLM narrative)
    └── src/ai/flows/rulesense-flow.ts       (existing — do not touch)
```

**Separation of concerns rule**: The FastAPI backend owns all ML inference, SHAP computation, rules evaluation, and database writes. The Next.js server actions (Genkit flows) own LLM narrative generation only — they consume the structured FastAPI response and wrap it in natural language.

---

## 3. COMPLETE FILE STRUCTURE

### Frontend additions (under `src/`)
```
src/
├── app/
│   ├── lab/
│   │   ├── layout.tsx                    # Lab shell with sidebar nav
│   │   ├── page.tsx                      # Lab landing — product selector
│   │   ├── underwriting/
│   │   │   └── page.tsx                  # Underwriting decisioning UI
│   │   ├── copilot/
│   │   │   └── page.tsx                  # AI Copilot UI
│   │   └── governance/
│   │       └── page.tsx                  # Governance dashboard
│   ├── case-studies/
│   │   ├── page.tsx                      # Case study index
│   │   └── [slug]/
│   │       └── page.tsx                  # Individual case study (static)
│   └── platform/
│       └── page.tsx                      # Platform capabilities overview
│
├── components/
│   ├── lab/
│   │   ├── InputPanel.tsx                # Left panel — form inputs
│   │   ├── OutputPanel.tsx               # Right panel — decision result
│   │   ├── ExplanationPanel.tsx          # SHAP feature bar chart
│   │   ├── AuditPanel.tsx                # Audit log entry display
│   │   ├── ScenarioSelector.tsx          # Preset applicant scenarios
│   │   ├── DemoModeToggle.tsx            # Demo / Live mode switch
│   │   └── CopilotNarrative.tsx          # LLM narrative output
│   ├── governance/
│   │   ├── DecisionHistoryTable.tsx      # Paginated decision log
│   │   ├── BiasIndicatorChart.tsx        # Approval rate by segment
│   │   └── FeatureImportanceChart.tsx    # Aggregate feature importance
│   └── shared/
│       └── DecisionBadge.tsx             # Approve/Reject/Review badge
│
├── lib/
│   └── api.ts                            # Typed fetch wrappers + error handling
│
└── ai/
    └── flows/
        └── credit-copilot-flow.ts        # NEW Genkit flow for LLM narrative
```

### Backend (new — `/backend/`)
```
backend/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
├── alembic/
│   └── versions/
│       └── 0001_initial_schema.py
├── app/
│   ├── main.py                           # FastAPI app factory + CORS
│   ├── database.py                       # Async SQLAlchemy engine + session
│   ├── core/
│   │   ├── config.py                     # Pydantic Settings (env vars)
│   │   └── logging.py                    # Structured JSON logging
│   ├── modules/
│   │   ├── underwriting/
│   │   │   ├── api.py                    # FastAPI router
│   │   │   ├── service.py                # Business logic orchestrator
│   │   │   ├── model.py                  # ML model class (train + predict)
│   │   │   └── schemas.py                # Pydantic request/response models
│   │   ├── copilot/
│   │   │   ├── api.py
│   │   │   └── service.py                # LLM prompt builder + caller
│   │   └── governance/
│   │       ├── api.py
│   │       └── service.py                # Decision history + bias metrics
│   └── shared/
│       ├── feature_engineering.py        # Feature transforms + encoding
│       ├── rules_engine.py               # Hard rule evaluator
│       ├── explainability.py             # SHAP wrapper
│       └── db_models.py                  # SQLAlchemy ORM models
└── tests/
    ├── conftest.py
    ├── test_underwriting.py
    └── test_governance.py
```

---

## 4. BACKEND IMPLEMENTATION GUIDE

### 4.1 Database Schema (`shared/db_models.py`)

```python
# Two tables required. Use UUID primary keys. Never use auto-increment integers in fintech.

class DecisionRecord(Base):
    __tablename__ = "decisions"
    id: UUID (primary key, default uuid4)
    created_at: DateTime (UTC, server default)
    applicant_ref: str (nullable — for multi-tenant future)
    input_payload: JSON (raw request)
    decision: str  # "approve" | "reject" | "review"
    credit_limit: Numeric(12, 2)
    apr: Numeric(5, 2)
    confidence_score: Numeric(5, 4)
    risk_segment: str  # "low" | "medium" | "high" | "thin_file"
    reason_codes: ARRAY(str)  # PostgreSQL ARRAY or JSON for SQLite
    shap_values: JSON
    model_version: str
    rules_triggered: JSON  # list of rule names that fired
    demo_mode: bool (default False)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: UUID (primary key)
    created_at: DateTime (UTC)
    decision_id: UUID (FK → decisions.id, ON DELETE CASCADE)
    event_type: str  # "decision_made" | "decision_reviewed" | "bias_check"
    actor: str  # "system" | user email
    metadata: JSON  # arbitrary context
```

### 4.2 Feature Engineering (`shared/feature_engineering.py`)

Transform raw inputs into model features:

```python
# All transforms must be deterministic and invertible (for explainability)

FEATURES = [
    "income_log",            # log1p(income) — handles skew
    "employment_length",     # raw years
    "housing_encoded",       # OHE: own=2, mortgage=1, rent=0
    "credit_score_imputed",  # if None: impute with segment mean (620)
    "thin_file_flag",        # 1 if credit_score is None
    "dti_ratio",             # debt-to-income proxy: (income * 0.36) / 12 / income
    "income_band",           # 0=<25k, 1=25-50k, 2=50-100k, 3=100k+
]

# ⚠️ CRITICAL: All imputation values must be stored with the model artifact
# so inference-time imputation is identical to training-time imputation.
```

### 4.3 Rules Engine (`shared/rules_engine.py`)

Hard rules that override the ML model (applied BEFORE ML scoring):

```python
# Rules are evaluated in priority order. First match that triggers REJECT wins.
# Reason codes map to FCRA-compliant adverse action codes.

RULES = [
    {
        "name": "minimum_income",
        "condition": lambda f: f["income"] < 18_000,
        "decision": "reject",
        "reason_code": "INCOME_BELOW_MINIMUM",
        "fcra_code": "AA-01",    # Income too low
    },
    {
        "name": "negative_employment",
        "condition": lambda f: f["employment_length"] < 0,
        "decision": "reject",
        "reason_code": "INVALID_EMPLOYMENT_DATA",
        "fcra_code": "AA-09",
    },
    {
        "name": "very_low_credit_score",
        "condition": lambda f: f.get("credit_score") is not None and f["credit_score"] < 500,
        "decision": "reject",
        "reason_code": "CREDIT_SCORE_TOO_LOW",
        "fcra_code": "AA-02",
    },
    {
        "name": "thin_file_review",
        "condition": lambda f: f.get("credit_score") is None and f["income"] < 40_000,
        "decision": "review",   # Not reject — send to human review queue
        "reason_code": "THIN_FILE_LOW_INCOME",
        "fcra_code": "AA-07",
    },
]
```

### 4.4 ML Model (`underwriting/model.py`)

```python
# Use a Scikit-learn Pipeline so preprocessing + model are one serializable artifact

from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

# Training data: generate synthetic dataset with realistic distributions
# - 10,000 samples
# - Approval rate ~68% (industry benchmark for prime/near-prime)
# - Stratify by income band and credit score tier

SYNTHETIC_TRAINING_CONFIG = {
    "n_samples": 10_000,
    "approval_rate_target": 0.68,
    "income_range": (15_000, 250_000),
    "credit_score_range": (500, 850),
    "random_seed": 42,  # Pin for reproducibility
}

# After training, serialize with joblib to: backend/models/underwriting_v1.pkl
# Store model version as SHA256 hash of the artifact file
# Log training metrics: AUC-ROC, Gini coefficient, KS statistic, approval rate

class UnderwritingModel:
    MODEL_VERSION = "1.0.0"

    def predict(self, features: dict) -> dict:
        # Returns: {"probability": float, "decision": str, "confidence_score": float}
        # confidence_score = abs(probability - 0.5) * 2  (0=uncertain, 1=certain)
        pass

    def compute_shap(self, features: dict) -> dict[str, float]:
        # Returns feature name → SHAP value (signed float)
        # Use shap.LinearExplainer for logistic regression
        pass

    def compute_credit_terms(self, probability: float, income: float) -> dict:
        # Credit limit: income-based with probability adjustment
        # base_limit = min(income * 0.15, 25_000)
        # adjusted_limit = base_limit * (0.5 + probability * 0.5)
        # Round to nearest $500
        #
        # APR: risk-based pricing
        # Tiers: <0.3 prob → 29.99%, 0.3-0.5 → 24.99%, 0.5-0.7 → 19.99%, >0.7 → 14.99%
        pass
```

### 4.5 API Contracts

#### `POST /api/underwriting/decision`

**Request:**
```json
{
  "income": 75000,
  "employment_length": 3,
  "housing_status": "rent",
  "credit_score": null,
  "scenario_tag": "thin_file",
  "demo_mode": false
}
```

**Response (200 OK):**
```json
{
  "decision_id": "018e8f2a-7c3d-7000-8000-000000000001",
  "decision": "approve",
  "credit_limit": 5500.00,
  "apr": 19.99,
  "confidence_score": 0.73,
  "risk_segment": "near_prime",
  "reason_codes": ["THIN_FILE_COMPENSATED_BY_INCOME"],
  "fcra_codes": ["AA-07"],
  "explanations": {
    "income_log": 0.42,
    "thin_file_flag": -0.31,
    "employment_length": 0.18,
    "housing_encoded": -0.05,
    "credit_score_imputed": -0.12
  },
  "audit": {
    "timestamp": "2026-03-23T10:00:00.000Z",
    "model_version": "1.0.0",
    "model_artifact_hash": "sha256:abc123...",
    "rules_evaluated": 4,
    "rules_triggered": ["thin_file_review"],
    "rules_overridden": false,
    "demo_mode": false
  }
}
```

**Error responses must follow RFC 7807 Problem Details:**
```json
{
  "type": "https://agenthive.ai/errors/validation",
  "title": "Input Validation Failed",
  "status": 422,
  "detail": "income must be a positive number",
  "instance": "/api/underwriting/decision"
}
```

#### `GET /api/underwriting/history`
```
Query params: page (int), page_size (int, max 100), decision (str), demo_mode (bool)
Response: { items: DecisionRecord[], total: int, page: int, pages: int }
```

#### `POST /api/copilot/explain`
```json
// Request — pass the full decision response from underwriting
{
  "decision_response": { ...underwriting response object... },
  "applicant_context": "Gig worker, 28yo, first-time credit applicant"
}
// Response
{
  "narrative": "Based on the applicant's income of $75,000 and stable employment of 3 years...",
  "risk_flags": ["No prior credit history (thin file)", "Rental housing — no property equity"],
  "recommendations": ["Consider secured card to build credit history", "Re-apply in 6 months with credit file established"],
  "plain_english_apr": "For every $1,000 balance, you'd pay approximately $16.66/month in interest"
}
```

#### `GET /api/governance/dashboard`
```json
{
  "period": "last_30_days",
  "total_decisions": 1247,
  "approval_rate": 0.71,
  "average_credit_limit": 6234.50,
  "average_apr": 20.14,
  "decisions_by_segment": {
    "prime": 423, "near_prime": 387, "high_risk": 201, "thin_file": 236
  },
  "approval_rate_by_segment": {
    "prime": 0.94, "near_prime": 0.78, "high_risk": 0.31, "thin_file": 0.58
  },
  "rules_triggered_frequency": {
    "minimum_income": 189, "thin_file_review": 236, "very_low_credit_score": 94
  },
  "top_reason_codes": [
    { "code": "THIN_FILE_LOW_INCOME", "count": 94, "pct": 0.075 }
  ]
}
```

#### `GET /api/governance/bias-report`
```json
{
  "disclaimer": "This report is for internal model monitoring only. Approval decisions are based on financial factors only.",
  "income_band_analysis": {
    "band_0_under_25k": { "total": 312, "approved": 98, "rate": 0.314 },
    "band_1_25k_50k":   { "total": 445, "approved": 287, "rate": 0.645 },
    "band_2_50k_100k":  { "total": 389, "approved": 312, "rate": 0.802 },
    "band_3_over_100k": { "total": 101, "approved": 97,  "rate": 0.960 }
  },
  "adverse_impact_ratio": 0.327,
  "disparate_impact_flag": true,
  "disparate_impact_threshold": 0.8
}
```

---

## 5. FRONTEND IMPLEMENTATION GUIDE

### 5.1 Lab Layout (`/lab/layout.tsx`)

- Persistent left sidebar (collapsible on mobile) with nav links:
  - Product Lab (index)
  - Underwriting Engine
  - AI Copilot
  - Governance Dashboard
- Show `DemoModeToggle` in sidebar header — persists to `localStorage`
- Protected by `withAuth` HOC (reuse existing)
- Breadcrumb at top of content area

### 5.2 `InputPanel.tsx`

```typescript
// Fields:
// income: number input (currency formatted, $0 – $999,999)
// employment_length: slider (0–30 years) with label "X years"
// housing_status: shadcn Select — "own" | "mortgage" | "rent"
// credit_score: number input (300–850) with "I don't have a credit score" checkbox
//               When checked: set to null and show thin-file info tooltip
// scenario_tag: hidden string, populated by ScenarioSelector

// Validation (Zod):
const schema = z.object({
  income: z.number().min(1_000).max(999_999),
  employment_length: z.number().min(0).max(30),
  housing_status: z.enum(["own", "mortgage", "rent"]),
  credit_score: z.number().min(300).max(850).nullable(),
})

// Submit button should show spinner during loading
// Disable form during loading (not just the button)
// On error: show inline error above submit (not toast — keep user in context)
```

### 5.3 `ScenarioSelector.tsx`

Preset applicant profiles for demo mode:

```typescript
const SCENARIOS = [
  {
    id: "prime_applicant",
    label: "Prime Applicant",
    description: "Established professional with strong credit",
    icon: "ShieldCheck",
    preset: { income: 120000, employment_length: 8, housing_status: "mortgage", credit_score: 760 }
  },
  {
    id: "near_prime",
    label: "Near-Prime Borrower",
    description: "Steady income, limited credit history",
    icon: "TrendingUp",
    preset: { income: 55000, employment_length: 2, housing_status: "rent", credit_score: 640 }
  },
  {
    id: "thin_file",
    label: "Thin-File Applicant",
    description: "No credit history — income-based assessment",
    icon: "User",
    preset: { income: 68000, employment_length: 3, housing_status: "rent", credit_score: null }
  },
  {
    id: "gig_worker",
    label: "Gig Economy Worker",
    description: "Irregular income, no formal employment",
    icon: "Zap",
    preset: { income: 42000, employment_length: 1, housing_status: "rent", credit_score: null }
  },
  {
    id: "new_immigrant",
    label: "New-to-Country Applicant",
    description: "High income, zero US credit history",
    icon: "Globe",
    preset: { income: 95000, employment_length: 0.5, housing_status: "rent", credit_score: null }
  },
  {
    id: "high_risk",
    label: "High-Risk Profile",
    description: "Low income with troubled credit",
    icon: "AlertTriangle",
    preset: { income: 22000, employment_length: 0, housing_status: "rent", credit_score: 510 }
  },
]
```

### 5.4 `OutputPanel.tsx`

Display decision result with these visual rules:
- **Approve**: green card border + `CheckCircle2` icon + `DecisionBadge` variant="success"
- **Reject**: red card border + `XCircle` icon + `DecisionBadge` variant="destructive"
- **Review**: yellow card border + `Clock` icon + `DecisionBadge` variant="warning"

Show:
1. Decision badge (prominent, top of card)
2. Credit limit (formatted as `$X,XXX`) — dimmed if rejected
3. APR (e.g., `19.99% APR`) — dimmed if rejected
4. Confidence meter (progress bar + label: "High Confidence", "Moderate", "Low")
5. Risk segment badge (prime / near-prime / high-risk / thin-file)
6. Reason codes (each as a `Badge` outline, with tooltip explaining the code in plain English)
7. `decision_id` (monospace font, copyable)
8. Elapsed time (measure from submit to response, show in milliseconds)

### 5.5 `ExplanationPanel.tsx`

```typescript
// Horizontal bar chart using Recharts
// Data: Object.entries(explanations).map([feature, shap_value])
// Color: positive SHAP = green bar (supports approval)
//        negative SHAP = red bar (hurts approval)
// Sort bars by absolute SHAP value (most impactful first)
// Show feature names in human-readable format:
//   income_log → "Annual Income"
//   thin_file_flag → "No Credit History"
//   employment_length → "Employment Duration"
//   housing_encoded → "Housing Status"
//   credit_score_imputed → "Credit Score"
// Add info tooltip: "Positive values support approval. Negative values reduce approval likelihood."
// Use Recharts ResponsiveContainer — must work at 320px width (mobile)
```

### 5.6 Governance Dashboard (`/lab/governance/page.tsx`)

Tabs: **Overview** | **Decision History** | **Bias Report**

**Overview tab:**
- 4 KPI cards: Total Decisions, Approval Rate, Avg Credit Limit, Avg APR
- Approval rate by segment — horizontal stacked bar (Recharts)
- Rules triggered frequency — bar chart

**Decision History tab:**
- `DecisionHistoryTable` with columns: Timestamp, Decision, Credit Limit, APR, Risk Segment, Reason Codes, Actions
- Client-side pagination (10 per page)
- Filter by: decision (all/approve/reject/review), demo_mode toggle
- Row click → modal with full decision detail (audit trail, SHAP values, all fields)

**Bias Report tab:**
- Prominent disclaimer banner (amber `Alert`): "For internal model monitoring only. Not for external reporting."
- Income band approval rate comparison chart
- Adverse impact ratio with visual indicator (green if >0.8, red if <0.8)
- Plain-English explanation of what disparate impact means

### 5.7 Case Studies (`/case-studies/`)

Three static case studies (hard-coded MDX or TSX):

```typescript
const CASE_STUDIES = [
  {
    slug: "thin-file-underwriting",
    title: "Expanding Credit Access for Thin-File Applicants",
    client: "Regional Digital Bank (anonymised)",
    problem: "30% of applicants declined solely due to absent credit history, despite stable income",
    approach: "Income-first ML model + SHAP explainability layer",
    model_design: "Logistic regression trained on cash-flow proxies (income, employment, housing)",
    business_impact: { approval_lift: "+18%", false_positive_reduction: "23%", time_to_decision: "< 800ms" },
    tags: ["Credit Inclusion", "Thin File", "Explainability"],
  },
  {
    slug: "gig-economy-credit",
    title: "Credit Decisioning for the Gig Economy",
    client: "BNPL Fintech (anonymised)",
    problem: "Traditional models reject gig workers at 60%+ rate despite adequate repayment capacity",
    approach: "Employment-length-tolerant model with income-band risk segmentation",
    business_impact: { approval_lift: "+31%", default_rate_delta: "+1.2% (within tolerance)", revenue_impact: "+$2.4M ARR" },
    tags: ["Gig Economy", "Risk Segmentation", "Alternative Data"],
  },
  {
    slug: "model-governance",
    title: "Implementing Model Governance for a Regulated Lender",
    client: "Consumer Lending Institution (anonymised)",
    problem: "No audit trail, no explainability, failing SR 11-7 model risk guidance",
    approach: "SHAP-based explainability + immutable audit log + bias monitoring dashboard",
    business_impact: { regulatory_findings: "0 (down from 4)", audit_readiness: "Full", time_to_explain_decision: "< 2s" },
    tags: ["Governance", "Explainability", "Compliance", "SR 11-7"],
  },
]
```

Each case study page renders: hero, problem/approach/impact sections, key metrics cards, CTA to Book Demo.

### 5.8 `src/lib/api.ts`

```typescript
// Typed fetch wrapper with:
// - Base URL from NEXT_PUBLIC_API_URL env var
// - Default timeout: 15 seconds (AbortController)
// - Auth header: Firebase ID token injected automatically
// - Error handling: throw typed ApiError with status + RFC 7807 fields
// - Retry: 1 retry on 502/503/504 with 500ms delay (network resilience)

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail: string,
    public instance: string,
  ) { super(detail) }
}

export const apiClient = {
  underwriting: {
    decide: (payload: UnderwritingRequest): Promise<UnderwritingResponse> => ...,
    history: (params: HistoryParams): Promise<PaginatedResponse<DecisionRecord>> => ...,
  },
  copilot: {
    explain: (payload: CopilotRequest): Promise<CopilotResponse> => ...,
  },
  governance: {
    dashboard: (period: string): Promise<GovernanceDashboard> => ...,
    biasReport: (): Promise<BiasReport> => ...,
  },
}
```

### 5.9 Genkit Flow: `credit-copilot-flow.ts`

```typescript
// This flow receives the structured FastAPI underwriting response
// and generates a human-readable narrative using Gemini 2.0 Flash.
// It does NOT call the ML model — that lives in FastAPI.
//
// Input: UnderwritingResponse (typed, from FastAPI)
// Output: CopilotNarrativeOutput{ narrative, risk_flags, recommendations, plain_english_apr }
//
// Prompt engineering requirements:
// - Persona: "You are a credit analyst at a regulated consumer lending institution."
// - Tone: Professional, factual, empathetic. No jargon without explanation.
// - FCRA compliance: Never state reason codes without plain-English explanation.
// - Length: narrative max 3 sentences. risk_flags max 3 items. recommendations max 3 items.
// - For rejected applicants: empathetic tone + actionable path to improve.
// - Do NOT hallucinate numbers not present in the input.
```

---

## 6. DEMO MODE IMPLEMENTATION

### Deterministic Mock Responses

When `demo_mode: true`, the FastAPI backend must:
1. Skip the ML model call entirely
2. Return pre-computed responses based on `scenario_tag`
3. Still write to the `decisions` table with `demo_mode=true`
4. Return `"model_version": "demo-1.0.0"` in audit

```python
DEMO_RESPONSES = {
    "prime_applicant": {
        "decision": "approve", "credit_limit": 15000.00, "apr": 14.99,
        "confidence_score": 0.94, "risk_segment": "prime",
        "reason_codes": ["STRONG_INCOME", "EXCELLENT_CREDIT_HISTORY"],
    },
    "thin_file": {
        "decision": "approve", "credit_limit": 5500.00, "apr": 19.99,
        "confidence_score": 0.62, "risk_segment": "thin_file",
        "reason_codes": ["THIN_FILE_COMPENSATED_BY_INCOME"],
    },
    "gig_worker": {
        "decision": "review", "credit_limit": 2000.00, "apr": 24.99,
        "confidence_score": 0.48, "risk_segment": "near_prime",
        "reason_codes": ["THIN_FILE_LOW_INCOME", "SHORT_EMPLOYMENT"],
    },
    "high_risk": {
        "decision": "reject", "credit_limit": 0, "apr": 0,
        "confidence_score": 0.87, "risk_segment": "high_risk",
        "reason_codes": ["INCOME_BELOW_MINIMUM", "CREDIT_SCORE_TOO_LOW"],
    },
}
```

Frontend `DemoModeToggle`:
- Persists to `localStorage` key `agentHive_demoMode`
- Shows amber banner when active: "Demo Mode Active — responses are illustrative"
- Toggle emits to a React context accessible by all lab pages

---

## 7. GOVERNANCE & COMPLIANCE REQUIREMENTS

### Every API response MUST include:
1. `decision_id` (UUID) — for audit trail linkage
2. `model_version` — for model risk management
3. `timestamp` (ISO 8601 UTC)
4. `rules_triggered` — list of rule names that evaluated to true

### Adverse Action Notice Data:
- Every `reject` or `review` decision must include `fcra_codes[]`
- These codes correspond to FCRA §615 adverse action reasons
- The frontend must render these with plain-English tooltips

### Bias Monitoring:
- The `adverse_impact_ratio` (lowest segment approval rate / highest segment approval rate) must be computed on every governance dashboard load
- Flag when ratio < 0.8 (the "four-fifths rule" from EEOC / CFPB guidance)
- Show disclaimer that this monitoring is based on income bands (not protected classes) and is for internal model risk management only

### Data Retention:
- Decision records: retain indefinitely (regulatory requirement)
- Audit logs: retain indefinitely
- Demo mode records: deletable (flag `demo_mode=true`)

---

## 8. WORLD-CLASS FINTECH UI/UX SYSTEM — FULL REBUILD

> **Directive**: Tear out every existing landing page component, layout, and CSS class that was scaffolded as a generic SaaS template. Replace the entire frontend visual layer with a design system that stands alongside Mercury, Brex, Stripe, and Linear. The UI is a product. It must make a CRO trust the system before they read a single data point.

---

### 8.0 Design Philosophy

| Principle | Implementation |
|---|---|
| **Data-first density** | Show numbers prominently. No empty space for aesthetic reasons — every pixel either displays data or creates breathing room that aids comprehension. |
| **Dark-first** | Default dark theme with a polished light alternative. Dark conveys authority in fintech (Bloomberg, Reuters, trading terminals). |
| **Trust through precision** | Tight grids, consistent rhythm, exact alignment. Sloppy spacing signals sloppy systems. |
| **Motion with purpose** | Animate to communicate state change (load → result), not for decoration. No bounces, no infinite loops. |
| **Progressive disclosure** | Show the decision first. Explain it second. Show the audit trail third. Never overwhelm. |

**Reference companies** (study their design systems before writing a single line of CSS):
- **Mercury Bank** → sidebar layout, data tables, clean card surfaces
- **Stripe Dashboard** → typography scale, action hierarchy, status badges
- **Brex** → data visualisation, enterprise metric cards, segment breakdowns
- **Linear** → keyboard-first app shell, sidebar + content split, muted surfaces
- **Vercel Dashboard** → deployment status indicators, monospace data, dark-first

---

### 8.1 Design Tokens (Mandatory — implement in `tailwind.config.ts`)

#### Color Palette

```typescript
// tailwind.config.ts — extend the existing shadcn/ui theme
const colors = {
  // Core brand
  brand: {
    50:  '#eef5ff',
    100: '#d9e9ff',
    200: '#bcd4fe',
    300: '#8eb6fd',
    400: '#598df9',
    500: '#3366f4',   // PRIMARY — electric blue, trust + intelligence
    600: '#1d48e8',
    700: '#1838cc',
    800: '#1a30a5',
    900: '#1b2e82',
    950: '#141e50',
  },
  // Decision semantic colors
  approve: {
    DEFAULT: '#10b981',   // emerald-500
    muted:   '#064e3b',   // emerald-900 (dark mode bg)
    text:    '#34d399',   // emerald-400 (dark mode text)
  },
  reject: {
    DEFAULT: '#ef4444',   // red-500
    muted:   '#450a0a',   // red-950 (dark mode bg)
    text:    '#f87171',   // red-400 (dark mode text)
  },
  review: {
    DEFAULT: '#f59e0b',   // amber-500
    muted:   '#451a03',   // amber-950 (dark mode bg)
    text:    '#fbbf24',   // amber-400 (dark mode text)
  },
  // Surface hierarchy (dark mode)
  surface: {
    base:     '#09090b',  // zinc-950 — page background
    raised:   '#111113',  // slightly lighter — card
    overlay:  '#18181b',  // zinc-900 — modal, dropdown
    border:   '#27272a',  // zinc-800 — all borders
    muted:    '#3f3f46',  // zinc-700 — dividers, disabled
  },
  // Data ink
  data: {
    positive: '#10b981',  // green bar in SHAP chart
    negative: '#ef4444',  // red bar in SHAP chart
    neutral:  '#71717a',  // neutral annotation
    accent:   '#3366f4',  // brand-colored emphasis
  },
}
```

#### Typography

```typescript
// fonts: load in layout.tsx alongside existing Space Grotesk
// Geist Mono → numbers, IDs, code, data values
// Space Grotesk → headings (already installed)
// Inter → body copy

const fontFamily = {
  heading: ['Space Grotesk', 'sans-serif'],   // already installed
  body:    ['Inter', 'sans-serif'],
  mono:    ['Geist Mono', 'ui-monospace', 'monospace'],
}

// Type scale — use these classes consistently:
// Display:   text-5xl font-bold tracking-tight font-heading      (hero H1)
// H1:        text-3xl font-bold tracking-tight font-heading      (page titles)
// H2:        text-xl  font-semibold font-heading                 (section headers)
// H3:        text-base font-semibold                             (card titles)
// Body:      text-sm text-muted-foreground leading-relaxed       (descriptions)
// Label:     text-xs font-medium uppercase tracking-widest       (field labels, tabs)
// Data:      text-2xl font-bold font-mono tabular-nums           (KPI numbers)
// Mono-sm:   text-xs font-mono text-muted-foreground             (IDs, timestamps)
```

#### Spacing & Layout Grid

```
Layout shell:
  Sidebar width:    240px (collapsed: 60px on desktop, drawer on mobile)
  Content max-w:    1280px
  Content padding:  px-6 py-8 (desktop) / px-4 py-6 (mobile)

Card anatomy:
  padding:          p-5 (compact data card) / p-6 (standard) / p-8 (hero card)
  border-radius:    rounded-xl (cards) / rounded-lg (inputs) / rounded-md (badges)
  border:           border border-surface-border
  shadow:           shadow-sm (resting) / shadow-lg ring-1 ring-white/5 (elevated)

Grid:
  KPI row:          grid-cols-2 md:grid-cols-4 gap-4
  Lab split:        grid-cols-1 lg:grid-cols-[380px_1fr] gap-6
  Case studies:     grid-cols-1 md:grid-cols-3 gap-6
```

---

### 8.2 Global Shell — Navbar & Sidebar

#### Top Navbar (`components/layout/navbar.tsx` — full rewrite)

```
Height: 56px, sticky, backdrop-blur-md, border-b border-surface-border
Background: bg-surface-base/80 (semi-transparent — glassmorphism)

Left:   AgentHive logomark (hexagonal hive icon SVG) + wordmark
Center: Primary navigation — Products | Platform | Case Studies | Pricing
Right:  [DemoModeToggle pill] [Docs link] [Log In ghost btn] [Get Access solid btn]

Mobile: hamburger → full-screen drawer with the same links
```

**Logo**: A single hexagonal SVG icon in brand-500 electric blue, with the wordmark "AgentHive" next to it. No decorative gradients on the logo itself — the sophistication comes from the restraint.

#### Lab Sidebar (`app/lab/layout.tsx` — new component)

```
Width: 240px fixed (desktop), drawer (mobile)
Background: bg-surface-raised border-r border-surface-border

Top section:
  [AgentHive logo row]
  [Demo Mode pill toggle — amber when active]

Nav section (label: "PRODUCT LAB"):
  [⚡ Underwriting Engine]
  [🤖 AI Copilot]
  [📊 Governance]

Nav section (label: "PLATFORM"):
  [📁 Case Studies]
  [🔌 API Reference]

Bottom section:
  [User avatar + email]
  [Log Out]

Active state: left accent bar (2px brand-500) + bg-brand-950 text-brand-300
Hover state:  bg-surface-overlay
All icons: lucide-react, 16px, consistent weight
```

---

### 8.3 Homepage — Full Redesign

The homepage is a **conversion machine**, not a brochure. Every section has a job to do.

#### Section 1: Hero

```
Background:
  - Deep dark: bg-surface-base
  - Radial mesh gradient behind the headline (CSS, not image):
    background: radial-gradient(ellipse 80% 50% at 50% -10%,
                  rgba(51, 102, 244, 0.15), transparent)
  - Subtle dot-grid overlay: SVG background-image repeating-linear-gradient pattern
  - NO stock photos, NO abstract blobs

Layout: Full-width, min-h-[90vh], centered content column (max-w-4xl)

Content — top to bottom:
  [Tag pill]    ─ "AI Credit Infrastructure"
                  bg-brand-950 text-brand-300 border border-brand-700
                  text-xs font-mono uppercase tracking-widest
                  Animate: fade-in-down, delay 0ms

  [H1]          ─ "Credit Decisioning\nBuilt for Scale."
                  text-6xl md:text-7xl font-bold tracking-tight font-heading
                  "Built for Scale." → gradient text: from-brand-400 to-brand-300
                  Animate: fade-in-up, delay 100ms

  [Subheading]  ─ "AI underwriting, explainability, and governance—\n
                   production-ready for lenders who can't afford guesswork."
                  text-lg text-zinc-400 max-w-2xl leading-relaxed
                  Animate: fade-in-up, delay 200ms

  [CTA row]     ─ ["Try Product Lab" → /lab]  ["See How It Works" → #how-it-works]
                  Primary: bg-brand-500 hover:bg-brand-600 text-white h-11 px-6 rounded-lg font-medium
                  Ghost:   border border-surface-border text-zinc-300 hover:bg-surface-overlay
                  Animate: fade-in-up, delay 300ms

  [Trust bar]   ─ "Designed for institutions operating under SR 11-7, FCRA §615, and CFPB guidance"
                  text-xs text-zinc-600 font-mono mt-8
                  Animate: fade-in, delay 500ms

  [Live metric ticker] — horizontal scrolling strip:
    「 Avg Decision Time: 340ms 」「 Approval Rate: 71.3% 」「 Decisions Today: 1,247 」
    「 Model AUC: 0.847 」「 Bias Flags: 0 active 」
    bg-surface-raised border-y border-surface-border py-3 text-xs font-mono text-zinc-500
    Auto-scroll left, pauses on hover
```

#### Section 2: Product Cards ("#products")

```
Layout: grid-cols-1 md:grid-cols-3 gap-5, max-w-6xl px-6

Each card:
  bg-surface-raised border border-surface-border rounded-2xl p-6
  hover: border-brand-500/40 shadow-lg shadow-brand-500/5 transition-all duration-300
  Top-left: icon in a 40px bg-brand-950 rounded-xl p-2
  H3: product name
  Body: 2-line description
  Bottom: "Explore →" text-brand-400 text-sm font-medium

Card 1: Underwriting Engine
  Icon: Scale (lucide)
  "ML-powered credit decisions with income-first modelling for prime, near-prime, and thin-file applicants."
  link → /lab/underwriting

Card 2: AI Copilot
  Icon: MessageSquareCode (lucide)
  "Natural language explanations for every decision. Built for credit analysts, not just engineers."
  link → /lab/copilot

Card 3: Governance Suite
  Icon: ShieldCheck (lucide)
  "Immutable audit logs, SHAP explainability, bias monitoring, and FCRA-compliant reason codes."
  link → /lab/governance
```

#### Section 3: How It Works ("#how-it-works") — animated step flow

```
Background: bg-surface-raised border-y border-surface-border

Layout: 4-column step flow (stacked on mobile)
Each step: number pill + icon + heading + 1-line description
Connector: horizontal dashed line between steps (hidden mobile)

Step 1: Input     → "Applicant profile submitted via API or Product Lab"
Step 2: Rules     → "Hard constraints evaluated — FCRA-compliant rejection gates"
Step 3: Inference → "ML model scores the application, SHAP computes factor weights"
Step 4: Decision  → "Structured JSON response with audit trail — under 500ms"
```

#### Section 4: Live Decision Preview — Animated

```
A full-width terminal/card mockup of a real decision response.
Use Framer Motion to animate JSON appearing line-by-line (typewriter effect, 20ms per char).
Background: bg-zinc-950 border border-surface-border rounded-2xl overflow-hidden

Top bar: three dots (red/yellow/green) + " POST /api/underwriting/decision" (monospace, zinc-500)
Content: JSON syntax-highlighted with custom spans:
  keys →    text-blue-400
  strings → text-amber-300
  numbers → text-emerald-400
  booleans → text-violet-400

Above the terminal: section header "See a Decision. In Real Time."
Below: CTA → "Run your own" → /lab/underwriting
```

#### Section 5: Case Study Teasers

```
grid-cols-1 md:grid-cols-3 gap-4
Each card: bg-surface-raised border border-surface-border rounded-xl p-5
  Top: tag chip (e.g., "Credit Inclusion")
  H3: case study title
  Stat callout: one key metric (e.g., "+18% approval lift")
               text-3xl font-bold font-mono text-brand-400
  Body: 1-line teaser
  Link: "Read case study →"
```

#### Section 6: Compliance Trust Strip

```
Background: bg-surface-base border-t border-surface-border
Layout: flex-row gap-8 justify-center flex-wrap py-8

Items (each: icon + label, text-zinc-500 text-xs font-mono):
  ✓  FCRA §615 Compliant
  ✓  SR 11-7 Model Governance
  ✓  SHAP Explainability
  ✓  Immutable Audit Logs
  ✓  Adverse Impact Monitoring
  ✓  ISO 8601 Timestamps
```

#### Section 7: CTA Footer Block

```
bg-brand-950 border-t border-brand-800 rounded-t-3xl mx-4 (detached card style)
padding: py-16 px-8 text-center

H2: "Ready to modernise your credit stack?"
Body: "Book a 30-minute technical demo with our team."
CTAs: ["Book a Demo" — solid brand-500] ["View API Docs" — ghost]
Subtext: "No commitment. Demo uses real synthetic data."
```

---

### 8.4 Product Lab Interface — Underwriting Page

#### Overall Layout

```
Page: /lab/underwriting
Shell: Lab sidebar (§8.2) + main content area

Content layout (CSS Grid):
  Desktop: grid-cols-[380px_1fr] gap-6 — fixed input panel, fluid output area
  Tablet:  grid-cols-1 — stacked, InputPanel first
  Mobile:  grid-cols-1 — stacked, tabs to switch between Input / Results

Context bar (above the grid):
  [Breadcrumb: Product Lab > Underwriting]  [Demo Mode pill]  [Model version badge: v1.0.0]
```

#### Input Panel Visual Spec

```
Card: bg-surface-raised border border-surface-border rounded-2xl p-6

Header:
  H2: "Applicant Profile"  text-base font-semibold
  Subtitle: "Enter financial profile to run ML decision"  text-xs text-zinc-500

Scenario Selector (above form fields):
  Label: "START WITH A SCENARIO"  text-[10px] font-mono uppercase tracking-widest text-zinc-600
  Grid: 2×3 scenario cards, each:
    bg-surface-overlay border border-surface-border rounded-lg p-3 cursor-pointer
    hover: border-brand-500/50
    active: border-brand-500 bg-brand-950
    Icon (20px) + label (text-xs font-medium) + description (text-[10px] text-zinc-500 truncate)
  Selecting a scenario populates all fields below with an animation (field value count-up)

Form fields:
  Each field group:
    Label: text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1
    Input: bg-surface-overlay border border-surface-border rounded-lg
           focus: border-brand-500 ring-1 ring-brand-500/30

  Income field:
    Left adornment: "$" text-zinc-500
    Input type=text, value formatted with commas (e.g., "75,000")
    Right: income band pill auto-updates as user types
      < $25k → red chip "Low"
      $25-50k → amber chip "Moderate"
      $50-100k → blue chip "Stable"
      > $100k → green chip "High"

  Employment Length:
    Slider (shadcn/ui Slider) + number display
    Below slider: ticks at 0, 5, 10, 20, 30 years

  Housing Status:
    shadcn/ui Select with icons in options
    Own 🏠 / Mortgage 🏦 / Rent 🔑

  Credit Score:
    Number input 300–850
    Credit quality bar: red 300–579 / amber 580–669 / yellow 670–739 / green 740–850
    Checkbox: "No credit history (thin file)" — when checked, score field dims + thin-file badge appears

Submit button:
  Full width, h-11, rounded-lg, CENTERED
  Idle:    bg-brand-500 text-white "Run Decision"
  Loading: bg-brand-600 text-white [Loader2 spin] "Analysing…"
  Disabled during loading
  Keyboard shortcut hint: "⌘ + Enter"  text-[10px] text-zinc-600 text-right mt-1
```

#### Output Panel Visual Spec

```
Default state (no decision yet):
  Empty state card: dashed border, centered icon + text
  "Submit an applicant profile to see the decisioning engine in action."

Loading state (while API call in flight):
  Show skeleton cards matching the output layout
  Pulse animation (Tailwind animate-pulse) — NOT a spinner overlay

Decision result:
  Row 1 — Decision Hero Card:
    Full-width card, border-l-4 color-coded (green/red/amber based on decision)
    Left: decision icon (40px) + decision label (text-2xl font-bold)
    Right: confidence arc (SVG radial progress) showing confidence_score %
    Background: subtle gradient — e.g., bg-gradient-to-r from-approve-muted/20 to-transparent

  Row 2 — Terms Grid (3 cards side by side):
    Card 1: Credit Limit   → "$5,500"  text-3xl font-bold font-mono
    Card 2: APR            → "19.99%"  text-3xl font-bold font-mono
    Card 3: Risk Segment   → "Near-Prime"  badge + short description
    All three: bg-surface-overlay rounded-xl p-4 text-center
    Dimmed with opacity-30 + line-through if decision = reject

  Row 3 — Reason Codes:
    Chips row: each reason code as a Badge with outline variant
    Hover: tooltip with plain-English explanation
    Rejected codes: destructive variant; compensating codes: default

  Row 4 — Decision ID + Timestamp (inline, monospace, copyable):
    [copy icon] d4f8a1b2-… · 2026-03-23T10:31:42Z · 340ms
    text-xs font-mono text-zinc-600
    Click to copy decision_id to clipboard + toast "Copied"
```

#### Explanation Panel (below the split grid, full width)

```
Card: bg-surface-raised border border-surface-border rounded-2xl p-6
Header: "Decision Factors"  text-base font-semibold
         + info icon with tooltip: "SHAP values show each factor's contribution to the decision. Positive = supports approval."

Recharts ResponsiveContainer height=260:
  BarChart, horizontal layout (layout="vertical")
  Bars sorted by absolute SHAP value (highest impact first)
  Positive bars: fill=data.positive (emerald)
  Negative bars: fill=data.negative (red)
  Custom Y-axis tick: human-readable feature names
  Custom tooltip: "Income: +0.42 (strong positive signal)"
  No legend — inline label on each bar end showing "±X.XX"
  Reference line at x=0 (center divider) — dashed, zinc-700
  Animate bars in on mount: animationBegin=0 animationDuration=800

Below chart:
  Two column grid: [Positive factors] [Negative factors]
  Each factor: icon dot + name + SHAP magnitude bar (thin, 4px tall)
```

#### Audit Panel (bottom, collapsible by default)

```
Collapsible section (shadcn/ui Collapsible or Accordion)
Header: [ChevronDown] "Audit Trail"  text-sm font-mono text-zinc-500
                      [model version chip]  [timestamp chip]

Expanded content (monospace terminal aesthetic):
  bg-zinc-950 rounded-xl p-4 text-xs font-mono text-zinc-400 leading-6
  Format each audit field as: KEY            value
  decision_id      018e8f2a-7c3d-…
  model_version    1.0.0
  artifact_hash    sha256:abc123…
  rules_evaluated  4
  rules_triggered  thin_file_review
  demo_mode        false
  timestamp        2026-03-23T10:31:42.000Z
  elapsed_ms       340

  [Copy full audit JSON] button — ghost, xs, right-aligned
```

---

### 8.5 AI Copilot Page

```
Page: /lab/copilot
Same layout as underwriting (sidebar + content area)

Top: Run underwriting decision first (inline prompt card)
     OR paste a decision_id from a previous run

Narrative output section:
  Card: bg-surface-raised rounded-2xl p-6
  Header: [Bot icon in brand-500] "Copilot Analysis" + ["Powered by Gemini" badge, monospace, xs]

  Narrative text:
    Render character-by-character (streaming effect using useState + setInterval)
    text-sm leading-7 text-zinc-300
    Highlight key figures (numbers, percentages) in font-mono text-brand-300

  Risk Flags section:
    Each flag: amber AlertTriangle icon + text, bg-review-muted/30 rounded-lg p-3 mb-2

  Recommendations section:
    Numbered list, each: chevron-right icon + text
    text-sm text-zinc-400

  Plain-English APR explainer:
    bg-surface-overlay rounded-lg p-4 border border-surface-border
    "💡 In plain terms: For every $1,000 balance, you'd pay approximately $16.66/month in interest."
    text-sm text-zinc-400 italic
```

---

### 8.6 Governance Dashboard — Data-Dense Design

```
Page: /lab/governance
Inspiration: part Bloomberg terminal, part Stripe Radar dashboard

Top KPI strip (4 cards, compact — h-28 each):
  [Total Decisions] [Approval Rate] [Avg Credit Limit] [Avg APR]
  Large number: text-3xl font-bold font-mono tabular-nums
  Trend: ↑ 4.2% vs last period   text-xs text-approve.text
  Sparkline (Recharts): 7-day mini-chart, w-20 h-8, no axes

Tabbed sections (shadcn/ui Tabs):
  Tab 1: Overview
    Row: [Approval Rate by Segment bar chart] + [Rules Triggered frequency bar]
    Row: [Decision volume over time line chart, 30-day]

  Tab 2: Decision History
    Full-width data table:
      Columns: Time | Decision | Credit Limit | APR | Segment | Rules | Actions
      Row striping: bg-surface-overlay on even rows
      Decision cell: inline DecisionBadge
      Time: relative ("2 min ago") + absolute on hover tooltip
      Actions: [View] button → sheet/drawer with full decision JSON
    Pagination: text-xs font-mono "Showing 1–10 of 1,247" + prev/next
    Filter bar: [Decision ▾] [Segment ▾] [Demo Mode toggle] [Search by ID]

  Tab 3: Bias Report
    Prominent amber disclaimer banner:
      bg-review-muted border border-amber-700 rounded-xl p-4 mb-6
      "⚠ Internal Model Monitoring — Not for External Reporting"

    Adverse Impact Ratio: centre card
      Large number: "0.327"  colored red (< 0.8 threshold)
      Progress arc: red arc showing ratio vs 0.8 threshold
      Below: "Four-fifths rule threshold: 0.80"
      Explainer button → Popover with 2-paragraph plain-English explanation

    Income band breakdown:
      Horizontal stacked bar — each band's approval vs rejection side by side
      Color: approve.DEFAULT vs reject.DEFAULT
      Below: sortable mini-table with exact numbers
```

---

### 8.7 Case Study Pages

```
Index page (/case-studies):
  Hero: H1 "Real Deployments. Measurable Outcomes."
        Subhead text-zinc-400
  Card grid: grid-cols-1 md:grid-cols-3 gap-6
    Each card: bg-surface-raised rounded-2xl overflow-hidden
               Top band: 4px solid accent (brand-500 / approve.DEFAULT / review.DEFAULT per study)
               Tag chip set: text-[10px] font-mono uppercase
               H3: study title
               Key metric: text-4xl font-bold font-mono text-brand-400 (+18%)
               1-line summary
               Footer: client type ("Regional Digital Bank, anonymised") text-zinc-600 text-xs

Individual page (/case-studies/[slug]):
  Layout: max-w-3xl centered (editorial layout — like Stripe case studies)

  Hero:
    Tag chips + H1 + 1-line problem statement
    Three metric pills horizontally: [+18% approval lift] [< 800ms decisions] [0 regulatory findings]
    bg-brand-950 text-brand-300 border border-brand-800 rounded-full px-3 py-1 text-sm font-mono

  Sections (with left border accent, linear.app-style):
    Problem / Approach / Model Design / Business Impact
    Each section: border-l-2 border-surface-border pl-5 mb-10

  Impact table:
    bg-surface-raised rounded-xl border border-surface-border
    Two columns: Metric | Result
    Result values: font-mono font-bold text-brand-300

  CTA: full-width card at base
    "Want this outcome for your portfolio?"
    [Book a Technical Demo]
```

---

### 8.8 Motion & Animation System

Install: `npm install framer-motion`

```typescript
// src/lib/animations.ts — reusable Framer Motion variants

export const fadeInUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

export const fadeInDown = {
  hidden:  { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.35, ease: 'easeOut' } },
}

export const staggerChildren = {
  visible: { transition: { staggerChildren: 0.07 } },
}

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

// Output panel — decision result appears with scaleIn
// Homepage sections — staggerChildren on scroll (use IntersectionObserver or Framer's whileInView)
// Lab form — field label slides in with fadeInDown when page mounts
// Recharts bars — use animationDuration=600 animationEasing="ease-out"

// DO NOT animate:
//   - Sidebar nav items (static)
//   - Table rows (performance risk with large tables)
//   - Loading skeletons (use CSS animation-pulse only)
```

**Animation rules**:
- Max duration: 400ms for UI transitions, 800ms for data visualisations
- Easing: always `ease-out` or custom cubic-bezier — never `linear` or `ease-in-out` for UI
- `prefers-reduced-motion`: wrap all Framer `motion.div` with a check; CSS transitions still run at reduced scale

---

### 8.9 Micro-Interactions (Required)

| Interaction | Behaviour |
|---|---|
| Copy `decision_id` | Icon morphs clipboard → check. Toast: "Decision ID copied" 2s auto-dismiss |
| Scenario card select | Cards slide to deselected state, selected scales 1.01 + border glows brand-500 |
| Income field typing | Income band pill transitions colour with 150ms crossfade |
| Credit score typing | Quality bar fills/drains with CSS transition 300ms |
| Submit hover | Button background brightens + subtle scale(1.01) |
| Decision arriving | Output panel fades from skeleton to content (200ms fade, scaleIn) |
| Tab switch (governance) | Content fades 150ms |
| Confidence arc | Animates from 0 to final score over 600ms on first render |
| Sidebar collapse | Smooth width transition 250ms, labels fade with opacity |
| Demo mode toggle | Amber banner slides down from navbar (height animation 300ms) |

---

### 8.10 Login / Signup — Fintech Auth UI (full rewrite of existing pages)

```
Layout: Split screen — left content panel (hidden mobile) + right form panel

Left panel (lg:w-1/2, bg-surface-raised, hidden on mobile):
  Vertically centered:
    [AgentHive logo]
    Large quote: "Built for lenders who can't afford guesswork."
    3-bullet trust list:
      ✓ ML decisioning < 500ms
      ✓ FCRA §615 reason codes
      ✓ Immutable audit trail
    Bottom: decision JSON preview card (same terminal aesthetic as homepage)

Right panel (w-full lg:w-1/2, bg-surface-base):
  Vertically centered, max-w-sm mx-auto:
    [Logo on mobile only]
    H1: "Sign in to AgentHive"
    Social auth: [Continue with Google — ghost button, full width]
    Divider: "or"
    Email field
    Password field (with show/hide toggle)
    [Forgot password?] right-aligned text-xs
    [Sign In — solid brand-500, full width, h-11]
    Footer: "Don't have an account? Get access →"

Forgot password page: same right-panel layout, just the email field + back link
```

---

### 8.11 Responsive Breakpoints

```
All pages must be tested at:
  375px  — iPhone SE (minimum — no scrollbar overlap, no clipped text)
  390px  — iPhone 15
  768px  — iPad portrait (sidebar becomes drawer)
  1024px — iPad landscape (lab split layout kicks in)
  1280px — Laptop (primary design target)
  1536px — Wide desktop (content still max-w-7xl, doesn't stretch)

Mobile-specific rules:
  - Lab page: input panel + output panel in tabs (not stacked scrollable columns)
  - Sidebar: bottom sheet drawer on mobile, not a side sheet
  - Charts: minimum height 200px, no x-axis label clipping
  - Decision badge: full-width on mobile
  - All font sizes: no smaller than 11px on mobile (WCAG AA)
```

---

### 8.12 Accessibility (WCAG AA — Required)

- All interactive elements: visible focus ring (`ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-base`)
- All colour combinations: contrast ratio ≥ 4.5:1 (verify with Chrome DevTools accessibility panel)
- All icons: `aria-hidden="true"` when decorative; `aria-label` when standalone interactive
- Form fields: explicit `<label>` elements, never placeholder-only labelling
- Charts: `role="img"` + `aria-label` describing the dataset and key insight
- Decision result: `aria-live="polite"` on the output panel — screen readers announce the decision
- Modal/Sheet: focus trap, `Escape` to close, focus returns to trigger element on close
- Loading states: `aria-busy="true"` on the output panel during API call

---

## 9. ENVIRONMENT VARIABLES

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
GOOGLE_GENAI_API_KEY=...
```

### Backend (`backend/.env`)
```bash
# App
APP_ENV=development          # development | staging | production
APP_PORT=8000
APP_LOG_LEVEL=INFO

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/agenthive
# For local dev without PostgreSQL:
DATABASE_URL=sqlite+aiosqlite:///./agenthive.db

# ML
MODEL_PATH=models/underwriting_v1.pkl
DEMO_MODE_DEFAULT=false

# LLM (backend copilot service)
OPENAI_API_KEY=sk-...         # Optional — uses mock if not set
OPENAI_MODEL=gpt-4o-mini

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://agenthivehq.com
```

---

## 10. LOCAL DEVELOPMENT SETUP

```bash
# Clone and navigate
cd AgentHiveHQ

# Frontend (existing — just add new pages)
npm install recharts framer-motion
npm run dev   # http://localhost:3000

# Backend (new service)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Train model and serialise to models/underwriting_v1.pkl
python -m app.modules.underwriting.model --train

# Run DB migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000

# Optional: Docker
docker-compose up --build
```

### requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy[asyncio]==2.0.29
asyncpg==0.29.0
aiosqlite==0.20.0
alembic==1.13.1
pydantic==2.7.0
pydantic-settings==2.2.1
scikit-learn==1.4.2
shap==0.45.0
numpy==1.26.4
pandas==2.2.2
joblib==1.4.0
openai==1.25.0
httpx==0.27.0
python-dotenv==1.0.1
pytest==8.2.0
pytest-asyncio==0.23.6
```

---

## 11. CODING STANDARDS (NON-NEGOTIABLE)

### TypeScript
- `strict: true` in `tsconfig.json` (already set)
- No `any` types — use `unknown` + type guards
- All API response types must have corresponding Zod schemas for runtime validation
- Component props must be explicitly typed interfaces (not inlined)

### Python
- Type annotations on every function signature
- Pydantic v2 models for all request/response shapes
- Async all the way: `async def` for all route handlers and DB operations
- No bare `except:` — always catch specific exceptions
- Log every decision with structured JSON: `logger.info("decision_made", extra={"decision_id": ..., "decision": ...})`

### Git Commit Style
```
feat(underwriting): add SHAP explainability to decision response
fix(governance): correct adverse impact ratio calculation
chore(backend): add Alembic migration for audit_logs table
```

### Error Handling Contract
- FastAPI: all unhandled exceptions → `ExceptionHandler` returns RFC 7807 JSON
- Next.js: all API calls wrapped in try/catch → typed `ApiError` displayed in-UI (not just console)
- Never show stack traces to the user

---

## 12. SEQUENCE OF IMPLEMENTATION

Build in this exact order to always have a working demo:

```
Phase 1 — Foundation (Days 1–3)
├── P1.1  Backend: project scaffold, FastAPI app factory, CORS, health endpoint
├── P1.2  Backend: database setup (SQLite), ORM models, Alembic migration
├── P1.3  Backend: feature engineering + rules engine (unit-testable, no ML yet)
├── P1.4  Backend: mock ML model (rule-based, returns realistic values)
├── P1.5  Backend: POST /api/underwriting/decision (end-to-end with mock model)
├── P1.6  Frontend: src/lib/api.ts with typed API client
└── P1.7  Frontend: /lab + /lab/underwriting — InputPanel + OutputPanel (wired to API)

Phase 2 — Intelligence (Days 4–7)
├── P2.1  Backend: synthetic training data generator
├── P2.2  Backend: real ML model (LogisticRegression pipeline, joblib serialization)
├── P2.3  Backend: SHAP explainability integration
├── P2.4  Frontend: ExplanationPanel with Recharts bar chart
├── P2.5  Frontend: ScenarioSelector + DemoModeToggle
├── P2.6  Backend: POST /api/copilot/explain (mock LLM fallback)
└── P2.7  Frontend: /lab/copilot + CopilotNarrative component

Phase 3 — Governance (Days 8–10)
├── P3.1  Backend: GET /api/underwriting/history (paginated)
├── P3.2  Backend: GET /api/governance/dashboard
├── P3.3  Backend: GET /api/governance/bias-report
├── P3.4  Frontend: /lab/governance — all three tabs
├── P3.5  Frontend: AuditPanel on underwriting page
└── P3.6  Genkit: credit-copilot-flow.ts (LLM narrative from Gemini)

Phase 4 — Backend Hardening (Days 11–14)
├── P4.1  Backend: Real LLM integration (OpenAI, with mock fallback)
├── P4.2  Backend: Alembic migration for PostgreSQL
├── P4.3  Docker: docker-compose for backend + PostgreSQL
└── P4.4  Tests: underwriting + governance test suites

Phase 5 — World-Class UI/UX Rebuild (Days 15–21) [§8]
├── P5.1  Install framer-motion; add Geist Mono font in layout.tsx; configure §8.1 design tokens in tailwind.config.ts
├── P5.2  Implement src/lib/animations.ts (fadeInUp, fadeInDown, staggerChildren, scaleIn)
├── P5.3  Rebuild Navbar: glassmorphism shell, hex logo SVG, nav links, CTA buttons
├── P5.4  Build Lab sidebar layout shell (§8.2) with collapsible nav + Demo Mode toggle
├── P5.5  Rebuild Homepage §8.3: hero (mesh gradient, metric ticker), product cards, how-it-works step flow
├── P5.6  Rebuild Homepage §8.3: animated JSON terminal preview section, case study teasers, compliance strip, CTA block
├── P5.7  Rebuild InputPanel §8.4: scenario cards with glow + count-up fill, income band pill, credit score quality bar
├── P5.8  Rebuild OutputPanel §8.4: decision hero card with border-l-4, terms grid, confidence SVG arc animation
├── P5.9  Rebuild ExplanationPanel §8.4: SHAP horizontal bar chart (colour-coded, sorted, animated), factor sub-grid
├── P5.10 Build AuditPanel §8.4: terminal aesthetic, monospace field table, copy-JSON button
├── P5.11 Rebuild Governance §8.6: KPI strip with sparklines, decision table with sheet drawer, bias report with arc
├── P5.12 Build /case-studies §8.7: index grid + individual editorial page with impact table
├── P5.13 Rebuild Login/Signup §8.10: split-screen auth layout with JSON terminal preview on left panel
├── P5.14 Implement all micro-interactions §8.9: copy toast, scenario glow, confidence arc, demo mode banner slide
└── P5.15 Responsive audit §8.11: verify 375px / 768px / 1024px / 1280px / 1536px; fix all overflow/clip issues
```

---

## 13. QUALITY BAR — DEFINITION OF DONE

A feature is **done** when:

- [ ] API endpoint has Pydantic input validation (returns 422 on bad input)
- [ ] API endpoint has a passing pytest test
- [ ] DB write succeeds (check with `GET /api/underwriting/history`)
- [ ] Frontend renders the response without console errors
- [ ] Loading state shown during API call
- [ ] Error state handled gracefully (not an unhandled crash)
- [ ] `decision_id` is visible and copyable in the UI
- [ ] Works in Demo Mode with deterministic output
- [ ] Works on mobile (375px viewport — test in Chrome DevTools)
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] No Python type errors (`mypy app/` clean)

### UI/UX Checklist (§8 — every page)
- [ ] Page background is `bg-surface-base` (zinc-950 dark) — not any default gray
- [ ] All KPI numbers use `font-mono tabular-nums` — no layout shift as values change
- [ ] All cards have `border border-surface-border` — no invisible card edges
- [ ] Decision output panel shows animated skeleton (not spinner) while loading
- [ ] SHAP bars animate in on mount (`animationDuration=800`) — not instant render
- [ ] Confidence arc animates 0 → final value over 600ms on first render
- [ ] Framer Motion NOT applied to table rows (perf-test with 100+ rows)
- [ ] `prefers-reduced-motion` media query disables JS animations (CSS transitions may still run)
- [ ] All interactive elements have visible focus rings (`ring-2 ring-brand-500`)
- [ ] No colour pair fails WCAG AA contrast check (≥ 4.5:1)
- [ ] Login page renders split-screen at 1024px+, single column at <768px
- [ ] Demo mode amber banner is visible, slides in, and includes dismiss or persists correctly
- [ ] "decision_id" copy toast appears and auto-dismisses within 2 seconds
- [ ] All Recharts charts are readable at 320px width (no label overflow or clip)
- [ ] Navbar glassmorphism renders correctly on both dark and light themes
- [ ] Metric ticker on homepage scrolls continuously and pauses on hover
- [ ] Animated JSON terminal preview on homepage renders without layout shift

---

## 14. WHAT SUCCESS LOOKS LIKE

A Chief Risk Officer sits down and:

1. Sees a professional platform — not a portfolio site
2. Selects "Thin-File Applicant" from the scenario selector
3. Clicks **Run Decision** — gets a result in under 1 second
4. Reads the SHAP chart: "Ah, income is the biggest positive factor"
5. Reads the AI Copilot narrative: understands the decision in plain English
6. Goes to Governance Dashboard: sees the approval rate by segment
7. Clicks into the Bias Report: understands the adverse impact ratio
8. Asks: "Can this be integrated with our loan origination system?"
9. Clicks **Book a Demo** — conversion achieved

**If any step in that journey feels like a toy, it's not done.**

### UI/UX Litmus Test

Open the platform on a laptop. Take a screenshot. Ask yourself these questions — if any answer is "no", keep building:

1. **Could this screenshot be mistaken for a Mercury Bank or Stripe Radar page?** If not — the design system isn't done.
2. **Are all numbers monospace, aligned, and non-shifting as values update?** If not — add `font-mono tabular-nums`.
3. **Does the dark background feel authoritative or like a night-mode afterthought?** If the latter — revisit the surface token hierarchy and gradient treatment.
4. **Can you locate the `decision_id` and copy it within 3 seconds without instruction?** If not — it's not prominent enough.
5. **Does the SHAP chart tell its story in under 5 seconds?** (Green = helps, red = hurts, longest bar = biggest factor.) If not — the chart needs better labelling and colour contrast.
6. **Shrink the browser to 375px. Does anything break, overflow, or become unreadable?** If yes — fix it before shipping.
7. **Navigate entirely by keyboard. Can you reach every interactive element?** If not — add focus rings and fix tab order.
8. **Does the homepage make you want to click "Try Product Lab"?** If not — the hero is not compelling enough.

**The UI is not decoration. It is the product's first argument for why the underlying technology should be trusted.**


---

## 15. EXTERNAL AI PRODUCT INTEGRATION ARCHITECTURE

> **Context**: AgentHive is a platform that orchestrates multiple AI products — including third-party vertical AI services such as **Thinfile Underwriting** (income-first credit assessment for applicants with no credit history), alternative scoring engines, or any partner-built inference API. This section defines how an external AI product is expected to behave, how the platform secures the integration boundary, and what capabilities are exposed to each user based on their authenticated role.

---

### 15.1 What the Platform Expects from an External AI Product

Every external AI product integrated into AgentHive must satisfy a **Product Integration Contract** — a machine-readable specification that governs the product's API surface, response guarantees, and failure behaviour. This is not optional. A product that does not conform to this contract will not be admitted to the platform.

#### 15.1.1 Required API Shape

An external product **MUST** expose the following HTTP API surface:

```
POST   /v1/inference          → Run a primary inference (e.g., credit decision)
GET    /v1/health             → Liveness + readiness probe
GET    /v1/metadata           → Product capabilities, model version, feature list
POST   /v1/explain            → SHAP or equivalent explainability payload (if ML-based)
GET    /v1/audit/{request_id} → Retrieve immutable record of a past inference
```

All responses **MUST** be JSON with the following envelope:

```json
{
  "request_id":    "uuid-v7",
  "product_id":    "thinfile-underwriting-v2",
  "model_version": "2.1.4",
  "timestamp":     "2026-03-24T10:00:00.000Z",
  "latency_ms":    214,
  "payload":       {},
  "audit": {
    "inputs_hash":   "sha256:...",
    "model_hash":    "sha256:...",
    "rules_applied": ["thin_file_income_gate", "employment_minimum"],
    "demo_mode":     false
  }
}
```

**Non-negotiable fields**: `request_id`, `model_version`, `timestamp`, `audit.model_hash`. Without these, the platform cannot build an auditable trace.

#### 15.1.2 Explainability Contract

Any ML-based external product **MUST** return a signed feature attribution payload alongside its primary response. The format must be SHAP-compatible (signed floats, one value per input feature):

```json
"explanations": {
  "income_zscore":        0.47,
  "employment_duration":  0.22,
  "housing_stability":   -0.11,
  "thin_file_flag":      -0.38
}
```

- Positive values indicate the feature **supports** the outcome (e.g., approval).
- Negative values indicate the feature **reduces** likelihood of the outcome.
- The sum of SHAP values must approximate `model_output - base_rate` (Shapley additivity).
- If a product cannot provide SHAP, it must provide a ranked reason code list with directional indicators. Products with no explainability at all are **rejected** from the platform.

#### 15.1.3 Latency & Availability SLA

| Metric | Requirement |
|---|---|
| p50 latency (inference) | <= 300 ms |
| p99 latency (inference) | <= 800 ms |
| Monthly availability | >= 99.5% |
| Cold-start latency | <= 2 000 ms (first request after idle) |
| Max response body | 512 KB |

Requests exceeding 800 ms trigger the platform's **circuit breaker**. Three consecutive 5xx responses place the product in **degraded mode** — the platform returns a structured fallback and alerts the operator.

#### 15.1.4 Idempotency & Determinism

- All inference endpoints **MUST** accept an `Idempotency-Key` header (UUID). Duplicate requests with the same key within a 24-hour window must return the identical payload — no re-scoring.
- Demo mode requests (flagged via `X-Demo-Mode: true`) must return **deterministic, pre-seeded responses** — never live model inference, to prevent demo data polluting audit history.

#### 15.1.5 Error Response Contract

All errors must follow RFC 7807 Problem Details format:

```json
{
  "type":     "https://agenthive.ai/errors/external-product/inference-failed",
  "title":    "Inference Failed",
  "status":   503,
  "detail":   "Upstream model server unavailable — retry after 30s",
  "instance": "/v1/inference",
  "meta": {
    "product_id":  "thinfile-underwriting-v2",
    "retry_after": 30,
    "request_id":  "018f1a2b-..."
  }
}
```

---

### 15.2 How the Platform Safeguards the Integration

Security at the integration boundary is **layered**. Each layer is independently enforced — a failure in one does not defeat the others.

#### 15.2.1 Authentication at the Integration Boundary

```
AgentHive Backend (FastAPI)
         |
         |  Outbound call to external AI product
         |
         +- Transport:   TLS 1.3 minimum — mTLS for partner-hosted products
         +- Credential:  Short-lived JWT (15-min TTL) signed by AgentHive Auth Service
         |               Header:  Authorization: Bearer <token>
         +- API key:     Long-lived secret for key rotation fallback
         |               Header:  X-AgentHive-Product-Key: <key>
         |               Storage: environment secret (never in code, never in DB)
         +- Request ID:  X-AgentHive-Request-Id: <uuid-v7>  (end-to-end trace)
```

JWT claims sent to the external product:

```json
{
  "iss":       "https://auth.agenthive.ai",
  "sub":       "platform-service-account",
  "aud":       "thinfile-underwriting-v2",
  "iat":       1711274400,
  "exp":       1711275300,
  "tenant_id": "acme-lending",
  "scope":     "inference:run audit:read",
  "demo_mode": false
}
```

The `scope` claim is the enforcement mechanism. A JWT with `scope: inference:run` cannot invoke `audit:delete` even if that endpoint exists on the product.

#### 15.2.2 Secret Management

```python
# backend/app/core/config.py
class ExternalProductSettings(BaseSettings):
    thinfile_base_url:   str
    thinfile_api_key:    SecretStr   # injected from environment — never logged
    thinfile_jwt_secret: SecretStr   # for signing outbound JWTs
    thinfile_timeout_ms: int = 800

    model_config = SettingsConfigDict(env_prefix="THINFILE_")
```

- Secrets are loaded from environment variables only — never from config files committed to source control.
- In production: inject via GCP Secret Manager / AWS Secrets Manager mounted as env vars.
- API key rotation: both old and new keys are accepted during a 24-hour grace period.
- `SecretStr` fields are masked in Pydantic `repr()` — they are never logged.

#### 15.2.3 Input Sanitisation Before Forwarding

```python
# backend/app/shared/external_product_gateway.py

class ExternalProductGateway:
    ALLOWED_FIELDS = frozenset([
        "income", "employment_length", "housing_status",
        "credit_score", "scenario_tag", "demo_mode",
    ])

    def sanitise_payload(self, raw: dict) -> dict:
        # 1. Whitelist — strip any field not in ALLOWED_FIELDS
        clean = {k: v for k, v in raw.items() if k in self.ALLOWED_FIELDS}

        # 2. Re-validate with Pydantic (defence-in-depth after front-door validation)
        payload = ExternalInferenceRequest(**clean)

        # 3. Assert no PII fields leaked through
        assert "ssn" not in clean and "date_of_birth" not in clean

        return payload.model_dump()
```

#### 15.2.4 Output Validation from External Product

Every response from an external product is:

1. **Schema-validated** against a Pydantic model before any processing. Validation failure is treated as a 500 from the external product.
2. **Range-checked**: `credit_limit >= 0`, `apr in [0, 100]`, `confidence_score in [0.0, 1.0]`.
3. **Persisted before caching**: raw JSON is written to `external_product_responses` as the immutable audit record before any transformation.
4. **Never raw-interpolated into prompts**: the copilot LLM receives a typed `dict`, not a free-form string.

#### 15.2.5 Rate Limiting & Circuit Breaker

```python
# backend/app/shared/circuit_breaker.py

class CircuitBreaker:
    """
    States:    CLOSED (normal) -> OPEN (fail fast) -> HALF_OPEN (probe)
    Threshold: 3 consecutive 5xx responses -> OPEN
    Timeout:   30 s in OPEN before switching to HALF_OPEN
    Recovery:  1 successful probe request -> CLOSED
    """
    FAILURE_THRESHOLD   = 3
    RECOVERY_TIMEOUT_S  = 30
    PROBE_SUCCESS_COUNT = 1
```

In `OPEN` state, the gateway returns a **structured fallback** — not a raw 500 to the frontend:

```json
{
  "decision":         "review",
  "credit_limit":     null,
  "apr":              null,
  "confidence_score": null,
  "risk_segment":     "unavailable",
  "reason_codes":     ["EXTERNAL_PRODUCT_UNAVAILABLE"],
  "audit": {
    "fallback_mode":   true,
    "fallback_reason": "circuit_breaker_open",
    "product_id":      "thinfile-underwriting-v2"
  }
}
```

The frontend renders fallback responses with an amber `Alert`: *"Real-time decisioning temporarily unavailable. This is an indicative result only."*

#### 15.2.6 Audit Logging at the Boundary

Every call to an external product generates two immutable audit entries:

```json
// On request dispatch:
{
  "event_type":  "external_product_request_dispatched",
  "product_id":  "thinfile-underwriting-v2",
  "request_id":  "018f1a2b-...",
  "actor":       "platform-service-account",
  "tenant_id":   "acme-lending",
  "inputs_hash": "sha256:...",
  "demo_mode":   false,
  "timestamp":   "2026-03-24T10:00:00.000Z"
}

// On response receipt:
{
  "event_type":    "external_product_response_received",
  "product_id":    "thinfile-underwriting-v2",
  "request_id":    "018f1a2b-...",
  "http_status":   200,
  "latency_ms":    214,
  "model_version": "2.1.4",
  "decision":      "approve",
  "fallback_used": false,
  "timestamp":     "2026-03-24T10:00:00.214Z"
}
```

These records are **append-only**. No `UPDATE` or `DELETE` is permitted on audit tables for production records (`demo_mode=false`).

---

### 15.3 Role-Based Exposure — What Each Role Can See

Authentication flows through **Firebase Auth**. Role assignment is stored as Firebase custom claims, injected at sign-in by a Cloud Function. The FastAPI backend validates the ID token on every request and enforces RBAC through a FastAPI dependency.

#### 15.3.1 Role Definitions

| Role | Who Has It | Assigned Via |
|---|---|---|
| `platform_admin` | AgentHive internal operators | Firebase Admin SDK (manual grant) |
| `tenant_admin` | Lender's IT/Risk admin | Tenant onboarding flow |
| `underwriter` | Credit analyst, underwriting team | Tenant admin invite |
| `compliance_officer` | Risk/compliance reviewer | Tenant admin invite |
| `api_partner` | External system (LOS, CRM) | Service account issuance |
| `readonly` | Auditor, exec viewer | Tenant admin invite |
| `demo` | Anonymous Product Lab visitor | Implicit — no auth required for demo scope |

#### 15.3.2 Role-to-Capability Matrix

| Capability | `platform_admin` | `tenant_admin` | `underwriter` | `compliance_officer` | `api_partner` | `readonly` | `demo` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Run live inference | Y | Y | Y | - | Y | - | - |
| Run demo inference | Y | Y | Y | - | Y | - | Y |
| View own decision result | Y | Y | Y | Y | Y | Y | Y |
| View any decision result | Y | Y | - | Y | - | Y | - |
| View SHAP explainability | Y | Y | Y | Y | Y | - | Y (demo) |
| View raw input payload | Y | Y | - | Y | - | - | - |
| Export decision history (CSV) | Y | Y | - | Y | - | - | - |
| View governance dashboard | Y | Y | - | Y | - | Y | - |
| View bias report | Y | Y | - | Y | - | - | - |
| Access full audit trail | Y | - | - | Y | - | - | - |
| Access external product metadata | Y | Y | - | - | Y | - | - |
| Manage product integrations | Y | - | - | - | - | - | - |
| Rotate API credentials | Y | Y | - | - | - | - | - |
| Delete demo mode records | Y | Y | - | - | - | - | - |

#### 15.3.3 Authentication Flow

```
Browser / API Client
       |
       |  1. Firebase sign-in (email/password or Google OAuth)
       v
Firebase Auth
       |
       |  2. Cloud Function trigger: sets custom claims from Firestore role record
       |     { "role": "underwriter", "tenant_id": "acme-lending", "product_scopes": ["thinfile"] }
       v
       |  3. Client receives ID token (JWT, 1hr TTL)
       |
       |  4. Client sends request:
       |     Authorization: Bearer <firebase-id-token>
       |     X-Tenant-Id:   acme-lending
       v
FastAPI Backend
       |
       |  5. Dependency: verify_firebase_token(token) -> decoded claims
       |  6. Dependency: require_role(["underwriter", "tenant_admin"]) -> 403 if unmet
       |  7. Dependency: require_product_scope("thinfile") -> 403 if not in product_scopes
       |
       |  8. Handler executes -> calls ExternalProductGateway with service-account JWT
       v
External AI Product (Thinfile Underwriting)
```

#### 15.3.4 FastAPI RBAC Enforcement

```python
# backend/app/core/auth.py

from firebase_admin import auth as firebase_auth
from fastapi import Depends, HTTPException, Request

async def verify_firebase_token(request: Request) -> dict:
    """Extract and verify Firebase ID token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[7:]
    try:
        return firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: list[str]):
    """Dependency factory — enforces the caller holds one of the allowed roles."""
    async def _check(claims: dict = Depends(verify_firebase_token)):
        user_role = claims.get("role", "demo")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user_role}' is not authorised. Required: {allowed_roles}"
            )
        return claims
    return _check

def require_product_scope(product_id: str):
    """Dependency factory — enforces the caller has access to the specified product."""
    async def _check(claims: dict = Depends(verify_firebase_token)):
        scopes: list[str] = claims.get("product_scopes", [])
        if product_id not in scopes and claims.get("role") != "platform_admin":
            raise HTTPException(
                status_code=403,
                detail=f"Your account does not have access to product '{product_id}'"
            )
        return claims
    return _check

# Example route guard:
@router.post("/decision")
async def run_decision(
    payload: UnderwritingRequest,
    claims: dict = Depends(require_role(["underwriter", "tenant_admin", "platform_admin", "api_partner"])),
    _scope: dict = Depends(require_product_scope("thinfile")),
):
    ...
```

#### 15.3.5 Frontend Role-Gated UI

Role gating is enforced on the **backend** (source of truth). The frontend applies a secondary UI layer to avoid presenting non-functional controls — but never relies on this as a security boundary:

```typescript
// src/contexts/auth-context.tsx — extend existing context

export type UserRole =
  | "platform_admin" | "tenant_admin" | "underwriter"
  | "compliance_officer" | "api_partner" | "readonly" | "demo";

interface AuthContextValue {
  user:          User | null;
  role:          UserRole;
  productScopes: string[];      // e.g., ["thinfile", "rulesense"]
  can:           (capability: Capability) => boolean;
}

// Capabilities map mirrors the role matrix in section 15.3.2
const ROLE_CAPABILITIES: Record<UserRole, Set<Capability>> = {
  platform_admin:      new Set(["run_live_inference", "view_bias_report", "manage_integrations" /*, ...*/]),
  tenant_admin:        new Set(["run_live_inference", "view_bias_report", "rotate_credentials" /*, ...*/]),
  underwriter:         new Set(["run_live_inference", "view_shap", "run_demo_inference" /*, ...*/]),
  compliance_officer:  new Set(["view_audit_trail", "view_bias_report", "export_history" /*, ...*/]),
  api_partner:         new Set(["run_live_inference", "view_shap" /*, ...*/]),
  readonly:            new Set(["view_governance_dashboard", "view_decision_result_any" /*, ...*/]),
  demo:                new Set(["run_demo_inference", "view_shap"]),
};
```

In component trees:

```tsx
const { can } = useAuth();

{can("view_bias_report") && (
  <Tab value="bias">Bias Report</Tab>
)}

{can("run_live_inference") ? (
  <Button onClick={runDecision}>Run Decision</Button>
) : (
  <Tooltip content="Your role does not have access to live inference">
    <Button disabled>Run Decision</Button>
  </Tooltip>
)}
```

> **Rule**: Never hide sensitive data by removing it from the DOM. If a role must not see raw input payloads, the API must not return them. The UI is a convenience layer, not a security boundary.

#### 15.3.6 API Partner Access (Machine-to-Machine)

External systems (Loan Origination Systems, CRMs) integrate as `api_partner` using service account credentials — not user sessions:

```
POST /api/underwriting/decision
Headers:
  Authorization:      Bearer <service-account-firebase-custom-token>
  X-Tenant-Id:        acme-lending
  X-Idempotency-Key:  <uuid-v7>
  X-Demo-Mode:        false
  Content-Type:       application/json
```

Service accounts are created by `tenant_admin` users via the platform UI. Each service account:
- Carries a fixed role of `api_partner` with scoped `product_scopes`
- Has a 90-day token TTL with automated rotation reminder
- Appears in the audit log as `actor: "service:acme-los-integration"` (never anonymous)
- Can be revoked instantly by `tenant_admin` or `platform_admin` — propagates to Firebase within seconds

**Token rotation workflow**:
1. New token issued — 24-hour grace period (old and new both accepted)
2. Old token disabled — consumers receive `401` with a `retry_with_new_token: true` body hint
3. Old token fully expired — `credential_rotated` audit entry written

---

### 15.4 Registering a New External AI Product

When a new external AI product is onboarded, complete this checklist before it receives live traffic:

```
[ ] Product integration contract reviewed and signed (section 15.1)
[ ] Health endpoint verified: GET /v1/health returns 200 within SLA
[ ] Latency benchmarked: p99 < 800 ms under 10 concurrent synthetic requests
[ ] Explainability validated: SHAP values sum within +/-5% of (output - base_rate)
[ ] RFC 7807 error format validated against all defined error codes
[ ] Idempotency verified: same Idempotency-Key returns identical payload twice
[ ] Demo mode verified: X-Demo-Mode: true returns deterministic, seeded responses
[ ] mTLS certificate pinned in gateway config (production environments)
[ ] API secret stored in Secret Manager — not in .env files
[ ] Circuit breaker thresholds configured for this product's SLA
[ ] Product record inserted into products table:
    { product_id, display_name, base_url, required_scopes, schema_version, onboarded_at }
[ ] Role matrix updated: which roles receive product_scope for this product (section 15.3.2)
[ ] Audit entry written: product_integration_registered (actor: platform_admin)
[ ] Smoke test: one live request + one demo request end-to-end, audit trail verified
[ ] Governance dashboard includes this product's decision history
```


---

## 15. EXTERNAL AI PRODUCT INTEGRATION ARCHITECTURE

> **Context**: AgentHive is a platform that orchestrates multiple AI products — including third-party vertical AI services such as **Thinfile Underwriting** (income-first credit assessment for applicants with no credit history), alternative scoring engines, or any partner-built inference API. This section defines how an external AI product is expected to behave, how the platform secures the integration boundary, and what capabilities are exposed to each user based on their authenticated role.

---

### 15.1 What the Platform Expects from an External AI Product

Every external AI product integrated into AgentHive must satisfy a **Product Integration Contract** — a machine-readable specification that governs the product's API surface, response guarantees, and failure behaviour. This is not optional. A product that does not conform to this contract will not be admitted to the platform.

#### 15.1.1 Required API Shape

An external product **MUST** expose the following HTTP API surface:

```
POST   /v1/inference          → Run a primary inference (e.g., credit decision)
GET    /v1/health             → Liveness + readiness probe
GET    /v1/metadata           → Product capabilities, model version, feature list
POST   /v1/explain            → SHAP or equivalent explainability payload (if ML-based)
GET    /v1/audit/{request_id} → Retrieve immutable record of a past inference
```

All responses **MUST** be JSON with the following envelope:

```json
{
  "request_id":    "uuid-v7",
  "product_id":    "thinfile-underwriting-v2",
  "model_version": "2.1.4",
  "timestamp":     "2026-03-24T10:00:00.000Z",
  "latency_ms":    214,
  "payload":       {},
  "audit": {
    "inputs_hash":   "sha256:...",
    "model_hash":    "sha256:...",
    "rules_applied": ["thin_file_income_gate", "employment_minimum"],
    "demo_mode":     false
  }
}
```

**Non-negotiable fields**: `request_id`, `model_version`, `timestamp`, `audit.model_hash`. Without these, the platform cannot build an auditable trace.

#### 15.1.2 Explainability Contract

Any ML-based external product **MUST** return a signed feature attribution payload alongside its primary response. The format must be SHAP-compatible (signed floats, one value per input feature):

```json
"explanations": {
  "income_zscore":        0.47,
  "employment_duration":  0.22,
  "housing_stability":   -0.11,
  "thin_file_flag":      -0.38
}
```

- Positive values indicate the feature **supports** the outcome (e.g., approval).
- Negative values indicate the feature **reduces** likelihood of the outcome.
- The sum of SHAP values must approximate `model_output - base_rate` (Shapley additivity).
- If a product cannot provide SHAP, it must provide a ranked reason code list with directional indicators. Products with no explainability at all are **rejected** from the platform.

#### 15.1.3 Latency & Availability SLA

| Metric | Requirement |
|---|---|
| p50 latency (inference) | <= 300 ms |
| p99 latency (inference) | <= 800 ms |
| Monthly availability | >= 99.5% |
| Cold-start latency | <= 2 000 ms (first request after idle) |
| Max response body | 512 KB |

Requests exceeding 800 ms trigger the platform's **circuit breaker**. Three consecutive 5xx responses place the product in **degraded mode** — the platform returns a structured fallback and alerts the operator.

#### 15.1.4 Idempotency & Determinism

- All inference endpoints **MUST** accept an `Idempotency-Key` header (UUID). Duplicate requests with the same key within a 24-hour window must return the identical payload — no re-scoring.
- Demo mode requests (flagged via `X-Demo-Mode: true`) must return **deterministic, pre-seeded responses** — never live model inference, to prevent demo data polluting audit history.

#### 15.1.5 Error Response Contract

All errors must follow RFC 7807 Problem Details format:

```json
{
  "type":     "https://agenthive.ai/errors/external-product/inference-failed",
  "title":    "Inference Failed",
  "status":   503,
  "detail":   "Upstream model server unavailable — retry after 30s",
  "instance": "/v1/inference",
  "meta": {
    "product_id":  "thinfile-underwriting-v2",
    "retry_after": 30,
    "request_id":  "018f1a2b-..."
  }
}
```

---

### 15.2 How the Platform Safeguards the Integration

Security at the integration boundary is **layered**. Each layer is independently enforced — a failure in one does not defeat the others.

#### 15.2.1 Authentication at the Integration Boundary

```
AgentHive Backend (FastAPI)
         |
         |  Outbound call to external AI product
         |
         +- Transport:   TLS 1.3 minimum — mTLS for partner-hosted products
         +- Credential:  Short-lived JWT (15-min TTL) signed by AgentHive Auth Service
         |               Header:  Authorization: Bearer <token>
         +- API key:     Long-lived secret for key rotation fallback
         |               Header:  X-AgentHive-Product-Key: <key>
         |               Storage: environment secret (never in code, never in DB)
         +- Request ID:  X-AgentHive-Request-Id: <uuid-v7>  (end-to-end trace)
```

JWT claims sent to the external product:

```json
{
  "iss":       "https://auth.agenthive.ai",
  "sub":       "platform-service-account",
  "aud":       "thinfile-underwriting-v2",
  "iat":       1711274400,
  "exp":       1711275300,
  "tenant_id": "acme-lending",
  "scope":     "inference:run audit:read",
  "demo_mode": false
}
```

The `scope` claim is the enforcement mechanism. A JWT with `scope: inference:run` cannot invoke `audit:delete` even if that endpoint exists on the product.

#### 15.2.2 Secret Management

```python
# backend/app/core/config.py
class ExternalProductSettings(BaseSettings):
    thinfile_base_url:   str
    thinfile_api_key:    SecretStr   # injected from environment — never logged
    thinfile_jwt_secret: SecretStr   # for signing outbound JWTs
    thinfile_timeout_ms: int = 800

    model_config = SettingsConfigDict(env_prefix="THINFILE_")
```

- Secrets are loaded from environment variables only — never from config files committed to source control.
- In production: inject via GCP Secret Manager / AWS Secrets Manager mounted as env vars.
- API key rotation: both old and new keys are accepted during a 24-hour grace period.
- `SecretStr` fields are masked in Pydantic `repr()` — they are never logged.

#### 15.2.3 Input Sanitisation Before Forwarding

```python
# backend/app/shared/external_product_gateway.py

class ExternalProductGateway:
    ALLOWED_FIELDS = frozenset([
        "income", "employment_length", "housing_status",
        "credit_score", "scenario_tag", "demo_mode",
    ])

    def sanitise_payload(self, raw: dict) -> dict:
        # 1. Whitelist — strip any field not in ALLOWED_FIELDS
        clean = {k: v for k, v in raw.items() if k in self.ALLOWED_FIELDS}

        # 2. Re-validate with Pydantic (defence-in-depth after front-door validation)
        payload = ExternalInferenceRequest(**clean)

        # 3. Assert no PII fields leaked through
        assert "ssn" not in clean and "date_of_birth" not in clean

        return payload.model_dump()
```

#### 15.2.4 Output Validation from External Product

Every response from an external product is:

1. **Schema-validated** against a Pydantic model before any processing. Validation failure is treated as a 500 from the external product.
2. **Range-checked**: `credit_limit >= 0`, `apr in [0, 100]`, `confidence_score in [0.0, 1.0]`.
3. **Persisted before caching**: raw JSON is written to `external_product_responses` as the immutable audit record before any transformation.
4. **Never raw-interpolated into prompts**: the copilot LLM receives a typed `dict`, not a free-form string.

#### 15.2.5 Rate Limiting & Circuit Breaker

```python
# backend/app/shared/circuit_breaker.py

class CircuitBreaker:
    """
    States:    CLOSED (normal) -> OPEN (fail fast) -> HALF_OPEN (probe)
    Threshold: 3 consecutive 5xx responses -> OPEN
    Timeout:   30 s in OPEN before switching to HALF_OPEN
    Recovery:  1 successful probe request -> CLOSED
    """
    FAILURE_THRESHOLD   = 3
    RECOVERY_TIMEOUT_S  = 30
    PROBE_SUCCESS_COUNT = 1
```

In `OPEN` state, the gateway returns a **structured fallback** — not a raw 500 to the frontend:

```json
{
  "decision":         "review",
  "credit_limit":     null,
  "apr":              null,
  "confidence_score": null,
  "risk_segment":     "unavailable",
  "reason_codes":     ["EXTERNAL_PRODUCT_UNAVAILABLE"],
  "audit": {
    "fallback_mode":   true,
    "fallback_reason": "circuit_breaker_open",
    "product_id":      "thinfile-underwriting-v2"
  }
}
```

The frontend renders fallback responses with an amber `Alert`: *"Real-time decisioning temporarily unavailable. This is an indicative result only."*

#### 15.2.6 Audit Logging at the Boundary

Every call to an external product generates two immutable audit entries:

```json
// On request dispatch:
{
  "event_type":  "external_product_request_dispatched",
  "product_id":  "thinfile-underwriting-v2",
  "request_id":  "018f1a2b-...",
  "actor":       "platform-service-account",
  "tenant_id":   "acme-lending",
  "inputs_hash": "sha256:...",
  "demo_mode":   false,
  "timestamp":   "2026-03-24T10:00:00.000Z"
}

// On response receipt:
{
  "event_type":    "external_product_response_received",
  "product_id":    "thinfile-underwriting-v2",
  "request_id":    "018f1a2b-...",
  "http_status":   200,
  "latency_ms":    214,
  "model_version": "2.1.4",
  "decision":      "approve",
  "fallback_used": false,
  "timestamp":     "2026-03-24T10:00:00.214Z"
}
```

These records are **append-only**. No `UPDATE` or `DELETE` is permitted on audit tables for production records (`demo_mode=false`).

---

### 15.3 Role-Based Exposure — What Each Role Can See

Authentication flows through **Firebase Auth**. Role assignment is stored as Firebase custom claims, injected at sign-in by a Cloud Function. The FastAPI backend validates the ID token on every request and enforces RBAC through a FastAPI dependency.

#### 15.3.1 Role Definitions

| Role | Who Has It | Assigned Via |
|---|---|---|
| `platform_admin` | AgentHive internal operators | Firebase Admin SDK (manual grant) |
| `tenant_admin` | Lender's IT/Risk admin | Tenant onboarding flow |
| `underwriter` | Credit analyst, underwriting team | Tenant admin invite |
| `compliance_officer` | Risk/compliance reviewer | Tenant admin invite |
| `api_partner` | External system (LOS, CRM) | Service account issuance |
| `readonly` | Auditor, exec viewer | Tenant admin invite |
| `demo` | Anonymous Product Lab visitor | Implicit — no auth required for demo scope |

#### 15.3.2 Role-to-Capability Matrix

| Capability | `platform_admin` | `tenant_admin` | `underwriter` | `compliance_officer` | `api_partner` | `readonly` | `demo` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Run live inference | Y | Y | Y | - | Y | - | - |
| Run demo inference | Y | Y | Y | - | Y | - | Y |
| View own decision result | Y | Y | Y | Y | Y | Y | Y |
| View any decision result | Y | Y | - | Y | - | Y | - |
| View SHAP explainability | Y | Y | Y | Y | Y | - | Y (demo) |
| View raw input payload | Y | Y | - | Y | - | - | - |
| Export decision history (CSV) | Y | Y | - | Y | - | - | - |
| View governance dashboard | Y | Y | - | Y | - | Y | - |
| View bias report | Y | Y | - | Y | - | - | - |
| Access full audit trail | Y | - | - | Y | - | - | - |
| Access external product metadata | Y | Y | - | - | Y | - | - |
| Manage product integrations | Y | - | - | - | - | - | - |
| Rotate API credentials | Y | Y | - | - | - | - | - |
| Delete demo mode records | Y | Y | - | - | - | - | - |

#### 15.3.3 Authentication Flow

```
Browser / API Client
       |
       |  1. Firebase sign-in (email/password or Google OAuth)
       v
Firebase Auth
       |
       |  2. Cloud Function trigger: sets custom claims from Firestore role record
       |     { "role": "underwriter", "tenant_id": "acme-lending", "product_scopes": ["thinfile"] }
       v
       |  3. Client receives ID token (JWT, 1hr TTL)
       |
       |  4. Client sends request:
       |     Authorization: Bearer <firebase-id-token>
       |     X-Tenant-Id:   acme-lending
       v
FastAPI Backend
       |
       |  5. Dependency: verify_firebase_token(token) -> decoded claims
       |  6. Dependency: require_role(["underwriter", "tenant_admin"]) -> 403 if unmet
       |  7. Dependency: require_product_scope("thinfile") -> 403 if not in product_scopes
       |
       |  8. Handler executes -> calls ExternalProductGateway with service-account JWT
       v
External AI Product (Thinfile Underwriting)
```

#### 15.3.4 FastAPI RBAC Enforcement

```python
# backend/app/core/auth.py

from firebase_admin import auth as firebase_auth
from fastapi import Depends, HTTPException, Request

async def verify_firebase_token(request: Request) -> dict:
    """Extract and verify Firebase ID token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = auth_header[7:]
    try:
        return firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: list[str]):
    """Dependency factory — enforces the caller holds one of the allowed roles."""
    async def _check(claims: dict = Depends(verify_firebase_token)):
        user_role = claims.get("role", "demo")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user_role}' is not authorised. Required: {allowed_roles}"
            )
        return claims
    return _check

def require_product_scope(product_id: str):
    """Dependency factory — enforces the caller has access to the specified product."""
    async def _check(claims: dict = Depends(verify_firebase_token)):
        scopes: list[str] = claims.get("product_scopes", [])
        if product_id not in scopes and claims.get("role") != "platform_admin":
            raise HTTPException(
                status_code=403,
                detail=f"Your account does not have access to product '{product_id}'"
            )
        return claims
    return _check

# Example route guard:
@router.post("/decision")
async def run_decision(
    payload: UnderwritingRequest,
    claims: dict = Depends(require_role(["underwriter", "tenant_admin", "platform_admin", "api_partner"])),
    _scope: dict = Depends(require_product_scope("thinfile")),
):
    ...
```

#### 15.3.5 Frontend Role-Gated UI

Role gating is enforced on the **backend** (source of truth). The frontend applies a secondary UI layer to avoid presenting non-functional controls — but never relies on this as a security boundary:

```typescript
// src/contexts/auth-context.tsx — extend existing context

export type UserRole =
  | "platform_admin" | "tenant_admin" | "underwriter"
  | "compliance_officer" | "api_partner" | "readonly" | "demo";

interface AuthContextValue {
  user:          User | null;
  role:          UserRole;
  productScopes: string[];      // e.g., ["thinfile", "rulesense"]
  can:           (capability: Capability) => boolean;
}

// Capabilities map mirrors the role matrix in section 15.3.2
const ROLE_CAPABILITIES: Record<UserRole, Set<Capability>> = {
  platform_admin:      new Set(["run_live_inference", "view_bias_report", "manage_integrations" /*, ...*/]),
  tenant_admin:        new Set(["run_live_inference", "view_bias_report", "rotate_credentials" /*, ...*/]),
  underwriter:         new Set(["run_live_inference", "view_shap", "run_demo_inference" /*, ...*/]),
  compliance_officer:  new Set(["view_audit_trail", "view_bias_report", "export_history" /*, ...*/]),
  api_partner:         new Set(["run_live_inference", "view_shap" /*, ...*/]),
  readonly:            new Set(["view_governance_dashboard", "view_decision_result_any" /*, ...*/]),
  demo:                new Set(["run_demo_inference", "view_shap"]),
};
```

In component trees:

```tsx
const { can } = useAuth();

{can("view_bias_report") && (
  <Tab value="bias">Bias Report</Tab>
)}

{can("run_live_inference") ? (
  <Button onClick={runDecision}>Run Decision</Button>
) : (
  <Tooltip content="Your role does not have access to live inference">
    <Button disabled>Run Decision</Button>
  </Tooltip>
)}
```

> **Rule**: Never hide sensitive data by removing it from the DOM. If a role must not see raw input payloads, the API must not return them. The UI is a convenience layer, not a security boundary.

#### 15.3.6 API Partner Access (Machine-to-Machine)

External systems (Loan Origination Systems, CRMs) integrate as `api_partner` using service account credentials — not user sessions:

```
POST /api/underwriting/decision
Headers:
  Authorization:      Bearer <service-account-firebase-custom-token>
  X-Tenant-Id:        acme-lending
  X-Idempotency-Key:  <uuid-v7>
  X-Demo-Mode:        false
  Content-Type:       application/json
```

Service accounts are created by `tenant_admin` users via the platform UI. Each service account:
- Carries a fixed role of `api_partner` with scoped `product_scopes`
- Has a 90-day token TTL with automated rotation reminder
- Appears in the audit log as `actor: "service:acme-los-integration"` (never anonymous)
- Can be revoked instantly by `tenant_admin` or `platform_admin` — propagates to Firebase within seconds

**Token rotation workflow**:
1. New token issued — 24-hour grace period (old and new both accepted)
2. Old token disabled — consumers receive `401` with a `retry_with_new_token: true` body hint
3. Old token fully expired — `credential_rotated` audit entry written

---

### 15.4 Registering a New External AI Product

When a new external AI product is onboarded, complete this checklist before it receives live traffic:

```
[ ] Product integration contract reviewed and signed (section 15.1)
[ ] Health endpoint verified: GET /v1/health returns 200 within SLA
[ ] Latency benchmarked: p99 < 800 ms under 10 concurrent synthetic requests
[ ] Explainability validated: SHAP values sum within +/-5% of (output - base_rate)
[ ] RFC 7807 error format validated against all defined error codes
[ ] Idempotency verified: same Idempotency-Key returns identical payload twice
[ ] Demo mode verified: X-Demo-Mode: true returns deterministic, seeded responses
[ ] mTLS certificate pinned in gateway config (production environments)
[ ] API secret stored in Secret Manager — not in .env files
[ ] Circuit breaker thresholds configured for this product's SLA
[ ] Product record inserted into products table:
    { product_id, display_name, base_url, required_scopes, schema_version, onboarded_at }
[ ] Role matrix updated: which roles receive product_scope for this product (section 15.3.2)
[ ] Audit entry written: product_integration_registered (actor: platform_admin)
[ ] Smoke test: one live request + one demo request end-to-end, audit trail verified
[ ] Governance dashboard includes this product's decision history
```

---

## 16. FIREBASE STUDIO RETIREMENT — HOSTING MIGRATION

> **Context**: Firebase Studio (which manages Firebase App Hosting) is being retired. The platform currently deploys via `apphosting.yaml` and depends on Firebase App Hosting for the Next.js frontend runtime. **Firebase Auth, Firestore, and Secret Manager are unaffected** — only the hosting layer must change.
>
> **Goal**: Migrate the Next.js 15 App Router frontend to a low-cost, low-effort alternative with minimal code changes. Firebase Auth stays. Genkit AI flows stay. The backend FastAPI service (Docker) stays on its separate infra.

---

### 16.1 What Is and Is Not Changing

| Layer | Current | After Migration | Code Change Required |
|---|---|---|---|
| Frontend runtime | Firebase App Hosting (`apphosting.yaml`) | New host (see §16.2) | Remove `apphosting.yaml`; add host config |
| Firebase Auth | Firebase SDK (`firebase` v11) | **Unchanged — stays as-is** | None |
| Genkit AI flows | Server Actions via `@genkit-ai/next` | **Unchanged — stays as-is** | None |
| Env secrets | Firebase Secret Manager (`NEXT_PUBLIC_*` vars) | Host env-var UI | Copy values to new host dashboard |
| FastAPI backend | Docker on Cloud Run / Fly.io | **Unchanged** | None |
| Domain / custom DNS | Firebase Hosting domain | Remap DNS CNAME to new host | DNS update only |

**Migration philosophy**: Swap only the compute layer that runs `next start`. Touch zero application code. The entire `apphosting.yaml` is the only Firebase-specific hosting artifact.

---

### 16.2 Recommended Options (Ranked by Effort + Cost)

#### Option A — Vercel ⭐ RECOMMENDED (Least Effort)

**Why**: Vercel is built by the Next.js team. Zero-config support for Next.js 15 App Router, Turbopack, and server actions. Import the GitHub repo and it deploys in one click.

| Attribute | Detail |
|---|---|
| Cost | Free tier: 100 GB bandwidth, 1 concurrent build. Pro: $20/mo |
| Migration effort | ~30 minutes |
| Next.js 15 support | Native — no adapter needed |
| Server Actions / Genkit | Fully supported (Node.js Vercel Functions) |
| Env vars | Dashboard → Settings → Environment Variables |
| Custom domain | Free SSL + CNAME in dashboard |
| Firebase Auth compat | Full — no code changes |
| Cold starts | < 50 ms |

**Migration steps:**

```
1. Push repo to GitHub (if not already)
2. vercel.com → "Add New Project" → Import repo
3. Framework preset: Next.js (auto-detected)
4. Copy all env vars from Firebase Secret Manager → Vercel Environment Variables:
     NEXT_PUBLIC_FIREBASE_API_KEY
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
     NEXT_PUBLIC_FIREBASE_PROJECT_ID
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
     NEXT_PUBLIC_FIREBASE_APP_ID
     GOOGLE_GENAI_API_KEY       (server-side only — no NEXT_PUBLIC_ prefix)
     NEXT_PUBLIC_API_URL        (points to FastAPI backend URL)
5. Click Deploy — first build runs automatically
6. Update custom domain DNS: CNAME record → cname.vercel-dns.com
7. Delete or archive apphosting.yaml (it is inert on Vercel)
```

**Cost**: $0/mo on Hobby tier for demo/early-stage traffic. $20/mo Pro if team features or multiple environments are needed.

---

#### Option B — Cloudflare Pages (Lowest Cost at Scale)

**Why**: Unlimited bandwidth on the free tier. Best choice if public traffic grows significantly. Requires a lightweight adapter.

| Attribute | Detail |
|---|---|
| Cost | Free: unlimited bandwidth, 500 builds/month |
| Migration effort | ~2–3 hours |
| Next.js 15 support | Via `@cloudflare/next-on-pages` adapter |
| Genkit compat | Partial — Genkit flows must be Edge-runtime compatible; audit required |
| Custom domain | Free SSL |
| Cold starts | < 10 ms (Cloudflare Edge network) |

**Risk**: Genkit's `@genkit-ai/googleai` package uses Node.js APIs that may not be available on the Cloudflare Edge runtime without polyfills (`nodejs_compat` flag). Run a compatibility check before committing:

```bash
npm install --save-dev @cloudflare/next-on-pages wrangler
npx @cloudflare/next-on-pages --help
```

Add to `wrangler.toml`:

```toml
name = "agenthivehq"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"
```

---

#### Option C — Render ($7/mo, Simplest Persistent Node.js Server)

**Why**: Runs a full persistent `next start` Node.js process — no cold-start limitations, no Edge runtime restrictions. Best if Genkit flows need unrestricted Node.js access (file system, native modules).

| Attribute | Detail |
|---|---|
| Cost | Free: 750 hrs/mo (sleeps after 15 min idle). Always-on: $7/mo |
| Migration effort | ~1 hour |
| Next.js 15 support | Full (`next start`) |
| Genkit compat | Full — no Node.js restrictions |
| Deployment | Connect GitHub → set build + start commands in dashboard |

```
Build command:  npm install && npm run build
Start command:  npm start
```

Optional `render.yaml` for infrastructure-as-code:

```yaml
services:
  - type: web
    name: agenthivehq-frontend
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: "20"
      - key: NEXT_PUBLIC_FIREBASE_API_KEY
        sync: false
```

---

#### Option D — Railway (~$5–15/mo, Best Developer Experience)

| Attribute | Detail |
|---|---|
| Cost | $5 credit/mo free, then usage-based (~$5–15/mo for light traffic) |
| Migration effort | ~45 minutes |
| Next.js 15 support | Full — Nixpacks auto-detects Next.js |
| Genkit compat | Full |
| Deployment | GitHub integration, auto-deploy on push |
| Env vars | Railway Dashboard → Variables tab |
| Custom domain | Free SSL included |

---

#### Option E — Google Cloud Run ⭐ BEST IF STAYING IN GOOGLE CLOUD

**Why**: Cloud Run is the natural Firebase App Hosting replacement within Google Cloud. Firebase App Hosting runs on Cloud Run internally — this option removes the Firebase Studio abstraction layer and talks directly to Cloud Run. Because the project already uses Firebase Auth, Google Secret Manager, and Genkit (Google AI), staying in the Google Cloud ecosystem means no cross-cloud IAM, no credential duplication, and unified billing.

| Attribute | Detail |
|---|---|
| Cost | Free tier: 2M requests/mo, 360,000 GB-seconds RAM, 180,000 vCPU-seconds. Paid: ~$0–5/mo light traffic |
| Migration effort | ~1–2 hours |
| Next.js 15 support | Full — runs `next start` in a Docker container |
| Genkit compat | Full — Node.js 20 container, no restrictions |
| Secret Manager | Native — mount secrets directly; no copy-paste to a host dashboard |
| Firebase Auth compat | Full — same Google project, zero config |
| Deployment | `gcloud run deploy` or Cloud Build CI/CD |
| Custom domain | Firebase Hosting as CDN in front of Cloud Run (recommended pattern) |
| Scale to zero | Yes — pay nothing when there is no traffic |
| Cold starts | 1–3 s on free tier; use min-instances=1 ($6/mo) to eliminate |

**Why this is the lowest-friction Google-native path**:
- Secret Manager integration is native — secrets are mounted as env vars at runtime, no dashboard copy-paste
- Same GCP project as Firebase — single IAM, single billing account, single audit log
- Firebase Hosting acts as a global CDN in front of Cloud Run (handles static assets, custom domain, free SSL)
- Genkit's `@genkit-ai/googleai` SDK uses ADC (Application Default Credentials) natively on Cloud Run — no `GOOGLE_API_KEY` env var needed if using Workload Identity

**One required code change** — add `output: 'standalone'` to `next.config.ts`:

```typescript
// next.config.ts  — only change needed
const nextConfig: NextConfig = {
  output: 'standalone',   // ADD THIS LINE
  // ...existing config unchanged
};
```

**Dockerfile** (add to repo root — separate from the backend Dockerfile):

```dockerfile
# Dockerfile.frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
```

> Note: Cloud Run expects port `8080` by default. `next start` binds to `$PORT` automatically with the standalone output.

**Deploy command** (manual / one-off):

```bash
gcloud run deploy agenthivehq-frontend \
  --source . \
  --dockerfile Dockerfile.frontend \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --set-secrets \
    NEXT_PUBLIC_FIREBASE_API_KEY=NEXT_PUBLIC_FIREBASE_API_KEY:latest,\
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:latest,\
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=NEXT_PUBLIC_FIREBASE_PROJECT_ID:latest,\
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:latest,\
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:latest,\
    NEXT_PUBLIC_FIREBASE_APP_ID=NEXT_PUBLIC_FIREBASE_APP_ID:latest,\
    GOOGLE_GENAI_API_KEY=GOOGLE_GENAI_API_KEY:latest,\
    NEXT_PUBLIC_API_URL=NEXT_PUBLIC_API_URL:latest
```

> Secrets are pulled from the existing Firebase/GCP Secret Manager automatically — the same secrets `apphosting.yaml` was referencing. No values need to be copied anywhere.

**Optional: Firebase Hosting as CDN in front of Cloud Run** (recommended — free SSL, global CDN, custom domain):

```json
// firebase.json  — update existing file (keep Auth config, just add hosting)
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "agenthivehq-frontend",
          "region": "us-central1"
        }
      }
    ]
  }
}
```

This routes all traffic through Firebase Hosting's CDN to your Cloud Run service — custom domain, free SSL, and static asset caching with zero extra cost.

**Cloud Build CI/CD** (add `cloudbuild-frontend.yaml` to repo root for automatic deploys on push):

```yaml
# cloudbuild-frontend.yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile.frontend
      - --build-arg
      - NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID
      - --build-arg
      - NEXT_PUBLIC_API_URL=$_NEXT_PUBLIC_API_URL
      - -t
      - gcr.io/$PROJECT_ID/agenthivehq-frontend:$COMMIT_SHA
      - .
  - name: gcr.io/cloud-builders/docker
    args: [push, gcr.io/$PROJECT_ID/agenthivehq-frontend:$COMMIT_SHA]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      - run
      - deploy
      - agenthivehq-frontend
      - --image=gcr.io/$PROJECT_ID/agenthivehq-frontend:$COMMIT_SHA
      - --region=us-central1
      - --platform=managed
substitutions:
  _NEXT_PUBLIC_API_URL: https://your-fastapi-backend.com
options:
  logging: CLOUD_LOGGING_ONLY
```

**Cost estimate** for light/demo traffic:

| Component | Monthly Cost |
|---|---|
| Cloud Run (scale-to-zero, < 2M requests) | $0 |
| Cloud Run (min-instances=1, eliminates cold start) | ~$6/mo |
| Firebase Hosting CDN (in front of Cloud Run) | $0 (free tier) |
| Secret Manager (< 10K access operations) | $0 |
| Cloud Build (first 120 build-minutes/day) | $0 |
| **Total (scale-to-zero)** | **$0–6/mo** |

---

### 16.3 Decision Matrix

```
                    Vercel       Cloudflare     Render        Railway      Cloud Run
                   (Rec. A)      Pages (B)       (C)           (D)          (E)
 ───────────────┬─────────────┬───────────────┬──────────────┬────────────┬─────────────
 Effort         │ 30 min      │ 2–3 hours     │ 1 hour       │ 45 min     │ 1–2 hours
 Free tier      │ Generous    │ Unlimited BW  │ 750 hrs/mo   │ $5 credit  │ 2M req/mo
 Paid cost      │ $20/mo      │ $0–25/mo      │ $7/mo        │ ~$10/mo    │ $0–6/mo
 Genkit compat  │ Full        │ Needs audit   │ Full         │ Full       │ Full
 Next.js 15     │ Native      │ Via adapter   │ Full         │ Full       │ Full
 Cold starts    │ < 50 ms     │ < 10 ms       │ Yes (free)   │ No         │ Yes ($0)
 Code changes   │ Zero        │ Adapter + cfg │ Zero         │ Zero       │ 1 line
 Secret Mgr     │ Copy-paste  │ Copy-paste    │ Copy-paste   │ Copy-paste │ Native mount
 Google stack   │ Partial     │ No            │ No           │ No         │ 100%
 Best for       │ Fastest win │ Scale at $0   │ Node.js APIs │ Team DevEx │ Stay Google
 ───────────────┴─────────────┴───────────────┴──────────────┴────────────┴─────────────
```

**Recommendation**:
- **Fastest migration with zero code changes** → **Vercel (Option A)**
- **Stay 100% in Google Cloud / Firebase ecosystem** → **Cloud Run (Option E)** — native Secret Manager, same GCP project, Firebase Hosting CDN in front, unified billing. One-line code change (`output: 'standalone'`).

---

### 16.4 Files to Add / Remove After Migration

#### Remove (Firebase App Hosting specific)

```
apphosting.yaml    ← delete entirely; has no equivalent or meaning on Vercel/Render/Railway
```

#### Add for Vercel (optional — only needed for custom security headers or API rewrites)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/backend/:path*",
      "destination": "https://your-fastapi-backend.com/api/:path*"
    }
  ]
}
```

---

### 16.5 Firebase Auth After Migration

Firebase Auth is a **client-side SDK** hosted entirely by Google's infrastructure. It has zero dependency on Firebase App Hosting. After migrating the hosting layer:

- `src/contexts/auth-context.tsx` — **no changes needed**
- Wherever `initializeApp()` is called — **no changes needed**
- All `NEXT_PUBLIC_FIREBASE_*` env vars — copy values from Firebase project settings into the new host's environment variable dashboard

**One required Firebase Console action** — add the new domain to Auth's allowlist:

```
Firebase Console → Authentication → Settings → Authorized Domains
→ Add: your-app.vercel.app
→ Add: your-custom-domain.com  (if applicable)
```

This is the single Firebase Console step needed for sign-in to work on the new host.

---

### 16.6 Migration Checklist

```
PRE-MIGRATION
[ ] Back up all secret values: Firebase Secret Manager → local .env file (keep secure)
[ ] Confirm NEXT_PUBLIC_API_URL (FastAPI backend) is publicly reachable
[ ] Note current custom domain and DNS provider (for CNAME update)
[ ] Note current Firebase Auth authorized domains list

MIGRATION — Vercel (Option A, ~30 min)
[ ] Import GitHub repo to Vercel dashboard
[ ] Paste all env vars (set NEXT_PUBLIC_* to both Build and Runtime availability)
[ ] Trigger first deploy — confirm build succeeds (check Vercel build logs)
[ ] Open Vercel preview URL — verify Firebase Auth login flow works end-to-end
[ ] Open Vercel preview URL — verify Genkit AI flows respond correctly
[ ] Open Vercel preview URL — verify FastAPI backend calls return data
[ ] Add custom domain in Vercel Settings → Domains
[ ] Update DNS: add CNAME record pointing to cname.vercel-dns.com
[ ] Wait for SSL certificate provisioning (~2–5 min)
[ ] Firebase Console → Authentication → Authorized Domains → add new domain

POST-MIGRATION
[ ] Full smoke test: login → run decision → view audit trail end-to-end
[ ] Delete apphosting.yaml from repo (commit and push)
[ ] Firebase Console → App Hosting → delete the retired backend (stops billing)
[ ] Set up Vercel deployment notifications (Slack or email) to replace Firebase alerts
[ ] Update README.md with new deployment URL and updated deploy instructions
```

---

### 16.7 Estimated Total Migration Effort and Cost

| Phase | Time | One-Time Cost | Monthly Cost |
|---|---|---|---|
| Vercel account setup + repo import | 5 min | $0 | $0 (Hobby tier) |
| Env var migration from Secret Manager | 10 min | $0 | — |
| DNS cutover + SSL certificate | 15 min + propagation | $0 | — |
| Firebase Auth domain allowlist update | 2 min | $0 | — |
| Smoke testing | 30 min | $0 | — |
| Firebase App Hosting teardown | 5 min | $0 | Saves ~$0–10/mo |
| **Total** | **~1 hour** | **$0** | **$0–20/mo** |

> **Bottom line**: Migrating to Vercel costs nothing upfront, requires zero application code changes, completes in under an hour, and eliminates the Firebase Studio / App Hosting dependency entirely while keeping Firebase Auth, Genkit flows, and the FastAPI backend untouched.
