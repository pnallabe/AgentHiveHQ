# PRD: AgentHive AI Product Lab Platform

---

## 1. Product Overview

**Product Name:** AgentHive AI Product Lab  
**Type:** Interactive AI Portfolio + Demo Platform + External AI Integration Hub  
**Target Users:**

- Heads of Credit
- Risk Managers
- Fintech Product Leaders
- **External AI Teams seeking to showcase and connect their FastAPI-based AI products**

---

## 2. Problem Statement

Traditional portfolios fail to demonstrate:

- Real-world decisioning
- Model governance
- Business impact

This creates low trust and weak conversion in financial services.

**Additionally**, AI teams building specialised products (fraud detection, KYC, income verification, etc.) outside the AgentHive platform have no standardised way to surface those products in a live, interactive demo environment without rebuilding front-end infrastructure from scratch.

---

## 3. Objectives

Build a platform that:

- Demonstrates production-like AI systems
- Enables hands-on interaction
- Converts visitors into consulting clients
- **Provides a plug-and-play integration gateway for external FastAPI-based AI products, enabling them to appear as first-class products inside the Lab without platform code changes**

---

## 4. User Personas

### 1. Chief Risk Officer
- **Wants:** Explainability, compliance
- **Concern:** Model risk

### 2. Product Manager (Fintech)
- **Wants:** Approval rates, UX
- **Concern:** Speed to market

### 3. External AI Builder *(new)*
- **Wants:** Showcase their FastAPI AI service inside a polished demo environment without rebuilding UI
- **Concern:** Integration effort, security, API contract compliance

### 4. Platform Administrator *(new)*
- **Wants:** Control which external products are listed, monitor usage and errors
- **Concern:** Data leakage, unreliable upstream services, contract drift

---

## 5. Core Features

### Feature 1: Product Lab Interface

**Description:** Interactive environment to test AI products

**Capabilities:**
- Select product (Underwriting / Copilot / **any registered external product**)
- Input applicant data
- View real-time decision

---

### Feature 2: Decision Engine API

**Inputs:** Income, Credit score (optional), Transaction features  
**Outputs:** Approval (Yes/No), Credit limit, APR

---

### Feature 3: Explainability Layer

**Outputs:** Top factors affecting decision, Reason codes (e.g., "Low income stability")

---

### Feature 4: AI Copilot (LLM)

**Output Example:**
> "Applicant is approved due to stable income and low DTI, but flagged for thin credit history."

---

### Feature 5: Governance Dashboard

**Includes:** Decision logs, Bias indicators, Feature importance

---

### Feature 6: Case Study Pages

**Structure:** Problem -> Approach -> Model design -> Business impact

---

### Feature 7: Lead Conversion System

- "Book Demo" CTA
- "Try with your data" form

---

### Feature 8: External AI Product Integration Gateway *(new)*

**Description:**  
A standardised integration layer that allows any team with a FastAPI-based AI service to register their product and have it rendered inside the AgentHive Lab as a fully functional, governed, and observable product card — without modifying platform source code.

#### 8.1 Product Registry
- External products are registered via a YAML/JSON manifest stored in `backend/integrations/registry/`
- Each manifest declares: `product_id`, `display_name`, `description`, `base_url`, `auth_type`, `input_schema`, `output_schema`, `health_check_path`, `demo_mode_supported`
- The Lab UI dynamically renders registered products using the generic `LabShell` and `InputPanel`/`OutputPanel` components

#### 8.2 Proxy Gateway

`/api/integrations/{product_id}/invoke`

- The AgentHive backend acts as a **secure proxy**: the frontend never calls external services directly
- The proxy: validates the request against the registered `input_schema` (Pydantic), injects platform auth headers, forwards to `base_url`, validates the response against `output_schema`, writes a `DecisionRecord` (with `source=external`, `product_id`), and returns a normalised response
- Timeout: 30s per call; automatic fallback to demo mode on upstream failure
- Rate limiting: 60 requests/minute per `product_id` (Redis-backed)

#### 8.3 Auth & Security
- **API Key auth:** External service registers a key; the proxy injects it as `X-AgentHive-Key` header
- **OAuth2 client credentials:** Supported for enterprise external services
- **mTLS:** Optional, for regulated financial services integrations
- All credentials stored in environment secrets — never in the registry manifest
- Outbound requests only permitted to HTTPS endpoints on the allowlist in `config.py`

#### 8.4 Normalised Contract

External FastAPI services **must** expose:

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness check — returns `{ "status": "ok" }` |
| `/schema` | GET | Returns OpenAPI JSON — used to auto-generate the input form |
| `/invoke` | POST | Main inference endpoint |

`/invoke` accepts:

```json
{
  "inputs": {},
  "demo_mode": false,
  "scenario_tag": null
}
```

`/invoke` must return:

```json
{
  "decision_id": "<uuid>",
  "decision": "approve | reject | review | <custom>",
  "summary": "<string shown in OutputPanel headline>",
  "details": {},
  "explanations": {},
  "reason_codes": [],
  "audit": {
    "model_version": "<string>",
    "timestamp": "<ISO8601 UTC>",
    "latency_ms": 0
  }
}
```

Fields outside the contract are passed through to a raw JSON collapsible in the UI.

#### 8.5 Auto-Generated Lab UI

When a product is registered:
- **InputPanel** generated automatically from `/schema` OpenAPI (field labels, types, validation ranges)
- **OutputPanel** uses `summary` + `decision` for badge/headline; `details` renders as key-value table; `explanations` renders in ExplanationPanel if present
- **AuditPanel** always shows `model_version`, `timestamp`, `latency_ms`, and `source: external`
- **CopilotNarrative** optionally wraps output if `copilot_enabled: true` in the manifest

#### 8.6 Health Monitoring
- Background job polls every 60s; updates status (`healthy` / `degraded` / `down`)
- Lab product card shows a live status badge
- Admin alert (email + Slack webhook) on any `down` transition

#### 8.7 Observability
- All proxied calls logged to `DecisionRecord` with `source="external"` and `product_id`
- Latency, error rate, and call volume per `product_id` in the Governance Dashboard Integrations tab
- Errors logged with RFC 7807 `ProblemDetail` format; surfaced as the same inline error card used by native products

---

## 6. User Journey (Demo Flow)

### Native Product Flow (unchanged)
1. User lands on homepage, clicks "Try Live Demo"
2. Selects scenario, inputs data, clicks Run Decision
3. Sees decision, explanation, risk flags
4. CTA: "Want this for your company?"

### External Product Integration Flow *(new)*
1. External AI team submits a manifest PR or uses the Admin UI
2. Platform admin reviews, approves, and merges — product appears in the Lab within minutes (no deploy needed)
3. Demo user selects the external product from the Lab product selector
4. Fills in the auto-generated schema-driven form, clicks Run
5. Proxy forwards request; external FastAPI responds; normalised output rendered
6. Decision, explanations, and audit panel all work identically to native products
7. CTA: "Integrate your AI product — talk to us"

---

## 7. Data Strategy

**Sources:**
- Synthetic generation (primary)
- Kaggle credit datasets (secondary)
- External products supply their own data; AgentHive stores only the normalised response JSON

**Enhancements:**
- Simulate thin file users, edge cases, bias scenarios
- External products can supply `DEMO_RESPONSES` via the manifest `demo_scenarios` key

---

## 8. Governance & Compliance

**Must Include:**
- Explainability (SHAP) for native products
- Audit logs: Input, Output, Timestamp, `source`, `product_id`
- External product calls governed identically to native: every call logged; no PII stored in proxy layer without explicit opt-in

**External Integration Compliance Requirements:**
- External services must declare their data residency region in the manifest
- AgentHive proxy strips PII fields declared in `pii_fields` before logging
- Adverse impact monitoring extends to external product decision distributions (Governance Integrations tab)

**Optional Advanced:**
- Fair lending checks via proxy variables
- mTLS for regulated integrations

---

## 9. Technical Architecture

### Frontend
- Next.js app — Pages: Home, Product Lab, Case Studies
- Schema-driven dynamic form rendering for external products
- Product Registry loaded from `/api/integrations` at Lab shell mount

### Backend — `/api/integrations` module
- `GET /api/integrations` — list registered products + live status
- `GET /api/integrations/{product_id}/schema` — proxied OpenAPI schema
- `POST /api/integrations/{product_id}/invoke` — secure proxy call
- `POST /api/integrations` (admin) — register new product manifest
- `DELETE /api/integrations/{product_id}` (admin) — deregister

### Model Layer
- Credit scoring model, Rules engine (native)
- External products own their model layer; AgentHive treats them as black-box

### LLM Layer
- Prompt-based explanations via Genkit / Gemini
- Copilot can wrap external product outputs if manifest declares `copilot_enabled: true`

### Integration Registry Structure

```
backend/integrations/
  registry/
    underwriting_v1.yaml          <- native (self-referencing, for parity)
    <external_product_id>.yaml    <- one file per registered external product
  proxy.py                        <- async httpx proxy with timeout + retry
  registry.py                     <- loads + validates manifests on startup
  health_monitor.py               <- background polling task
  schemas.py                      <- Pydantic models: ProductManifest, InvokeRequest, NormalisedResponse
```

### Manifest Schema Example

```yaml
product_id: fraud-detector-v2
display_name: Real-Time Fraud Detector
description: ML-powered transaction fraud scoring with SHAP explanations
base_url: https://fraud-api.partner.io
auth_type: api_key
health_check_path: /health
invoke_path: /invoke
schema_path: /openapi.json
copilot_enabled: true
demo_mode_supported: true
demo_scenarios:
  - tag: high_risk_transaction
    label: High-Risk Transaction
  - tag: low_risk_transaction
    label: Low-Risk Transaction
pii_fields: [account_number, ssn]
data_residency: us-east-1
timeout_seconds: 30
rate_limit_rpm: 60
```

---

## 10. API Design

### Native Decision Endpoint (unchanged)

`POST /api/underwriting/decision`

```json
// Request
{
  "income": 75000,
  "employment_length": 3,
  "credit_score": null
}

// Response
{
  "decision": "approve",
  "limit": 5000,
  "apr": 18.5,
  "reason_codes": ["low_credit_history"]
}
```

### External Integration Endpoints *(new)*

```
GET    /api/integrations
GET    /api/integrations/{product_id}/schema
POST   /api/integrations/{product_id}/invoke
POST   /api/integrations                          (admin: register)
DELETE /api/integrations/{product_id}             (admin: deregister)
```

**Invoke Request:**

```json
{
  "inputs": { "<field>": "<value>" },
  "demo_mode": false,
  "scenario_tag": null
}
```

**Normalised Invoke Response:**

```json
{
  "decision_id": "uuid-v4",
  "decision": "approve",
  "summary": "Low-risk transaction. Fraud probability: 2.1%",
  "details": { "fraud_score": 0.021, "velocity_flag": false },
  "explanations": { "amount": -0.4, "merchant_category": 0.1 },
  "reason_codes": ["low_amount", "known_merchant"],
  "audit": {
    "model_version": "fraud-v2.3.1",
    "timestamp": "2026-03-24T10:00:00Z",
    "latency_ms": 42
  }
}
```

---

## 11. Deployment Plan

### Phase 1 (2-3 weeks)
- Basic UI, rule-based model, static demo

### Phase 2 (3-5 weeks)
- ML model, SHAP explainability, LLM copilot

### Phase 3 (2 weeks)
- Auth, logging, case studies

### Phase 4 — External Integration Gateway *(new)*
- Integration registry loader + manifest validation on startup
- Secure proxy with auth, timeout, rate limiting
- Schema-driven dynamic form generation in Lab UI
- Health monitoring background task + status badges on product cards
- Governance Integrations tab (latency, error rate, call volume per product)
- Admin UI: register / deregister products, view integration health
- Developer documentation: "How to make your FastAPI service AgentHive-compatible"

---

## 12. Success Metrics

### Product Metrics
- Demo completion rate
- Time spent on Product Lab
- Number of external products integrated
- Integration invoke success rate (target: >= 99%)
- External product p95 latency (target: <= 500ms)

### Business Metrics
- Demo requests
- Client conversions
- External AI teams onboarded (pipeline metric)

---

## 13. Future Expansion

- Fraud detection module (native)
- Line increase optimization
- Multi-tenant client demos
- **Self-serve registration portal** — submit manifest, auto-validate contract compliance, preview in sandbox
- **AgentHive SDK** (`pip install agenthive-sdk`) — FastAPI middleware that auto-exposes `/health`, `/schema`, `/invoke` from any existing FastAPI app with one decorator
- **Webhook callbacks** — external product pushes async result for long-running ML inference jobs
- **A/B testing framework** — route a percentage of Lab invocations to an alternate product version and compare output distributions in Governance Dashboard
