# AgentHive — Technical Architecture Document

**Version:** 1.0 | **Date:** April 2026  
**Owner:** CTO / Engineering | **Audience:** Engineering, Security, Investors, Technical Advisors

---

## 1. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL CALLERS                                  │
│   Loan Origination Systems │ Partner APIs │ AgentHive Lab UI │ Admin Portal  │
└────────────────────────────────┬──────────────────────────────────────────────┘
                                 │ HTTPS (TLS 1.3)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / LOAD BALANCER (GCP Cloud Run)               │
│                    Rate limiting │ mTLS (enterprise) │ CORS │ WAF             │
└────────────────────────────────┬──────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼───────────────────┐
              ▼                  ▼                   ▼
┌─────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐
│  DECISION ENGINE    │ │  GOVERNANCE API  │ │  INTEGRATION GATEWAY  │
│  (FastAPI/uvicorn)  │ │  (FastAPI)       │ │  (FastAPI)            │
│  - /score           │ │  - /audit/pkg    │ │  - /integrations/{id} │
│  - /score/batch     │ │  - /reports/fl   │ │  - /registry          │
│  - TrafficRouter    │ │  - /models       │ │  - /health/{id}       │
└──────────┬──────────┘ └────────┬─────────┘ └──────────┬────────────┘
           │                     │                       │
           ▼                     ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CORE SERVICES LAYER                                │
│                                                                              │
│ ┌────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│ │ Feature        │ │ Model        │ │ SHAP         │ │ Audit Fabric     │  │
│ │ Pipeline       │ │ Registry     │ │ Explainer    │ │ Service          │  │
│ │ (sklearn)      │ │ Service      │ │ (TreeExpl.)  │ │                  │  │
│ └────────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘  │
│                                                                              │
│ ┌────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│ │ Decision       │ │ Fair Lending │ │ LLM Copilot  │ │ Monitoring       │  │
│ │ Engine         │ │ Test Suite   │ │ Service      │ │ Service          │  │
│ │ (PD→Decision)  │ │ (4/5ths rule)│ │ (OpenAI/OSS) │ │ (PSI/AUC/Drift) │  │
│ └────────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  PostgreSQL 16  │ │  Redis (Cache +  │ │  Object Store    │
│  (Primary DB)   │ │  Rate Limiting)  │ │  (GCS / S3)      │
│  - decisions    │ │                  │ │  - models/*.pkl  │
│  - audit_events │ └──────────────────┘ │  - audit_pkgs/   │
│  - model_reg    │                      │  - reports/      │
│  - fair_lending │                      └──────────────────┘
│  - monitoring   │
└─────────────────┘
```

---

## 2. Core Components

### 2.1 Decision Engine

| Attribute | Detail |
|---|---|
| **Framework** | FastAPI + uvicorn (4 workers, async) |
| **Model** | LightGBM gradient boosted tree (binary classification) |
| **Calibration** | Platt Scaling (logistic regression wrapper on raw LightGBM scores) |
| **Output** | Calibrated PD in \[0,1\]; decision: APPROVE/CONDITIONAL/DECLINE |
| **Traffic routing** | `TrafficRouter` — deterministic MD5 hash-based canary splits (configurable %) |
| **Latency target** | p95 < 200ms end-to-end |
| **Constraints** | Monotonic constraints enforced at training time (prevent non-compliant reversals) |

**Decision thresholds (configurable by CRO):**
```python
class DecisionEngine:
    APPROVE_THRESHOLD: float = 0.05      # PD < 5%
    CONDITIONAL_THRESHOLD: float = 0.10  # 5% ≤ PD < 10%
    # PD ≥ 10% → DECLINE
```

### 2.2 Feature Pipeline

| Feature Family | Features | Source |
|---|---|---|
| Income stability | `monthly_income_avg`, `income_volatility_std`, | Bank txn data |
| Cash flow | `expense_to_income_ratio`, `liquidity_buffer_months` | Bank txn data |
| Behavioral signals | `payment_consistency_score`, `account_tenure_months` | Bank txn data |
| Shock sensitivity | `shock_sensitivity_score`, `max_income_drop_pct` | Bank txn data |
| Proxy credit | `num_tradelines`, `credit_utilization_proxy` | Alt data / synthetic |

Pipeline is a scikit-learn `Pipeline` object, serialized to `models/feature_pipeline_v{version}.pkl`. Version is pinned at inference time.

### 2.3 SHAP Explainability Layer

```python
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(feature_vector)
# Top 3 by absolute value → mapped to ECOA adverse action codes
adverse_action_reasons = map_shap_to_adverse_action_codes(
    shap_values, feature_names, code_table
)
```

- SHAP values computed for every real-time and batch decision
- Values stored in `feature_snapshots` table for audit replay
- ECOA adverse action code table maintained by Compliance; maps feature + direction to code

### 2.4 Audit Fabric

The Audit Fabric is the governance infrastructure layer. It is **not** a reporting bolt-on — it is a core service that runs co-located with the decision engine.

**Components:**
- `AuditLogger` — writes immutable records to PostgreSQL (`decisions`, `feature_snapshots`, `audit_events` tables)
- `ModelRegistry` — tracks every deployed model version with hash, metadata, deploy/retire timestamps
- `AuditPackageBuilder` — programmatic assembly of OCC-format audit package:
  - `exam_packet.json` (machine-readable)
  - `exam_packet.pdf` (ReportLab-rendered, OCC format)
  - `chain_of_custody.json`
  - `fair_lending_summary.json` with sub-reports per protected class
- `FairLendingTestSuite` — ECOA disparate impact tests, rate-spread disparity analysis, HMDA export

### 2.5 Monitoring & Analytics Service

| Monitor | Metric | Alert Threshold | Frequency |
|---|---|---|---|
| Population Stability Index (PSI) | Feature distribution shift | PSI > 0.20 | Daily |
| AUC drift | Holdout AUC vs. baseline | Drop > 0.05 | Weekly |
| Approval rate | Rolling 30-day | ±10% shift | Daily |
| Fair lending ratio | Income quintile DI ratio | < 0.80 | Daily |
| API latency | p95 response time | > 250ms | Real-time (Prometheus) |
| Error rate | 5xx responses | > 0.5% | Real-time (Prometheus) |

Metrics exposed to Prometheus `/metrics`; Grafana dashboards for ops team; critical alerts to PagerDuty.

### 2.6 Integration Gateway

```
External FastAPI Service
        │
        │ Registered via YAML manifest in integrations/registry/
        ▼
AgentHive Proxy (/api/integrations/{product_id}/invoke)
        │ Validates input against registry input_schema (Pydantic)
        │ Injects X-AgentHive-Key auth header
        │ Times out at 30s; falls back to demo_mode
        │ Validates response against output_schema
        │ Writes DecisionRecord (source="external")
        ▼
Normalized Response to Frontend
        │
        ▼
AgentHive Lab UI (auto-generated InputPanel / OutputPanel)
```

Rate limiting: Redis-backed, 60 req/min per `product_id`.  
Health polling: 60s interval; `healthy` / `degraded` / `down` states.

---

## 3. Data Pipelines and Storage

### 3.1 Database Schema (PostgreSQL 16)

```sql
-- Core decision record (immutable)
decisions (
  decision_id UUID PRIMARY KEY,
  application_id VARCHAR,
  model_version VARCHAR,
  risk_score FLOAT,
  decision ENUM('APPROVE','CONDITIONAL','DECLINE'),
  credit_limit FLOAT,
  apr FLOAT,
  decision_timestamp TIMESTAMPTZ,
  source VARCHAR,                    -- 'native' or 'external'
  product_id VARCHAR
);

-- Full feature snapshot for audit replay
feature_snapshots (
  snapshot_id UUID PRIMARY KEY,
  decision_id UUID REFERENCES decisions,
  features JSONB,                    -- full feature vector
  shap_values JSONB,
  adverse_action_reasons JSONB,
  captured_at TIMESTAMPTZ
);

-- Model version registry
model_versions (
  model_id UUID PRIMARY KEY,
  version_string VARCHAR,
  artifact_hash VARCHAR,             -- SHA-256 of .pkl file
  deployed_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  status ENUM('ACTIVE','SHADOW','RETIRED'),
  metadata JSONB                     -- training params, AUC, PSI baseline
);

-- Monitoring snapshots
monitoring_metrics (
  metric_id UUID PRIMARY KEY,
  model_version VARCHAR,
  metric_name VARCHAR,
  metric_value FLOAT,
  computed_at TIMESTAMPTZ,
  alert_triggered BOOLEAN
);
```

### 3.2 Object Storage (GCS)
```
gs://agenthive-artifacts/
├── models/
│   ├── lgbm_v1.0.0.pkl
│   └── feature_pipeline_v1.0.0.pkl
├── audit_packages/
│   └── audit_package_<model_id>_<timestamp>/
└── reports/
    ├── fair_lending/
    └── monitoring/
```

---

## 4. Model Lifecycle Management

```
[Data Exploration] → [Feature Engineering] → [Training]
        │                                         │
        ▼                                         ▼
[Reject Inference]                         [Validation Gate]
                                                  │
                                    Passes: AUC > 0.70, PSI < 0.10
                                    Fair lending: DI ratio > 0.80
                                                  │
                                                  ▼
                                        [Shadow Mode Deployment]
                                      (TrafficRouter: 5% canary)
                                                  │
                                    Monitor: 4-week shadow period
                                                  │
                                                  ▼
                                        [Production Cutover]
                                             (full traffic)
                                                  │
                                    Ongoing: PSI, AUC, fair lending
                                                  │
                                    Trigger: PSI > 0.20 or AUC -0.05
                                                  │
                                                  ▼
                                           [Retrain Cycle]
```

---

## 5. Security & Compliance Architecture

| Control | Implementation |
|---|---|
| **Transport security** | TLS 1.3 on all endpoints; mTLS available for enterprise integrations |
| **Authentication** | API Key middleware (all requests); OAuth2 client credentials (enterprise); JWT for UI sessions |
| **Secrets management** | GCP Secret Manager; no credentials in codebase or manifests (validated by gitleaks pre-commit hook) |
| **Audit logging** | All write operations logged with user ID, timestamp, IP; immutable PostgreSQL records |
| **Data residency** | US-only deployment by default; GCP us-central1; data never leaves US boundary |
| **PII handling** | Applicant PII encrypted at rest (AES-256); pseudonymized in SHAP outputs and monitoring metrics |
| **Vulnerability scanning** | Pre-commit hooks (gitleaks, bandit); dependency scanning in CI/CD (GitHub Actions) |
| **SOC 2 Type II scope** | Security, Availability, Confidentiality — audit initiated Q2 2026 |
| **GDPR/CCPA** | Data subject deletion workflow via `/decisions/{id}/purge` (soft-delete with audit trail preserved) |

---

## 6. Suggested Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Scoring API** | Python 3.11, FastAPI, uvicorn | Async, high-performance, native Pydantic validation |
| **ML Model** | LightGBM + scikit-learn Pipeline | Best-in-class gradient boosting; sklearn pipeline for deployment simplicity |
| **Explainability** | SHAP (TreeExplainer) | Exact SHAP values for tree models; < 5ms overhead |
| **Calibration** | scikit-learn CalibratedClassifierCV (Platt) | Produces well-calibrated probabilities for PD interpretation |
| **Database** | PostgreSQL 16 | ACID compliance; JSONB for flexible feature storage; proven at scale |
| **Cache / Rate limiting** | Redis 7 | Sub-millisecond; cluster mode for HA |
| **Object storage** | GCP Cloud Storage | Durable model artifact storage; versioned |
| **Container runtime** | Docker + GCP Cloud Run | Serverless scaling; cost-efficient for burst workloads |
| **Monitoring** | Prometheus + Grafana + PagerDuty | Industry standard; integrates with GCP |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS | SSR for performance; type safety |
| **CI/CD** | GitHub Actions + GCP Cloud Build | Automated test + deploy pipeline |
| **PDF generation** | ReportLab | OCC-format audit package PDFs |
| **Migrations** | Alembic (Postgres) | Version-controlled DB schema |

---

## 7. Scalability Considerations

| Scenario | Current Architecture | Scale Path |
|---|---|---|
| **10K decisions/day** | Single Cloud Run instance (4 workers) | Current design handles this comfortably |
| **1M decisions/day** | | Horizontal Cloud Run scaling; Redis Cluster; read replicas for PostgreSQL |
| **Multi-tenant (10+ customers)** | Shared infra | Schema-level tenant isolation in PostgreSQL; separate API key namespaces |
| **Model fleet (50+ models)** | Single model registry | Model serving abstraction layer; containerized model microservices |
| **Real-time streaming** | Batch job | Add Kafka/Pub-Sub ingest layer; streaming feature pipeline with Flink/Spark Streaming |
| **99.9% SLA** | Single region | Multi-region active-passive with GCP; < 15min RTO |
