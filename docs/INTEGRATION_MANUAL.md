# AgentHive External AI Product Integration — Technical Manual

**Version:** 1.0.0 · **Platform:** AgentHive AI Product Lab · **Phase:** 4 (Integration Gateway)

---

## Table of Contents

1. [Overview](#1-overview)
2. [How It Works](#2-how-it-works)
3. [API Contract Your Service Must Implement](#3-api-contract-your-service-must-implement)
4. [Writing Your Manifest File](#4-writing-your-manifest-file)
5. [Authentication Setup](#5-authentication-setup)
6. [Running ThinFile Locally](#6-running-thinfile-locally)
7. [Registering Your Product](#7-registering-your-product)
8. [Testing the Integration](#8-testing-the-integration)
9. [Governance — What Gets Logged](#9-governance--what-gets-logged)
10. [Health Monitoring](#10-health-monitoring)
11. [Rate Limits & Timeouts](#11-rate-limits--timeouts)
12. [Troubleshooting](#12-troubleshooting)
13. [Production Checklist](#13-production-checklist)
14. [Appendix A — Full Manifest Reference](#appendix-a--full-manifest-reference)
15. [Appendix B — FastAPI Minimal Template](#appendix-b--fastapi-minimal-template)

---

## 1. Overview

The AgentHive **Integration Gateway** (Phase 4) lets any team with a FastAPI-based AI service plug into the AgentHive Lab as a first-class product — without modifying platform source code.

Once registered, your product:

- Appears in the Lab **Integration Gateway** page (`/lab/integrations`)
- Has an auto-generated invocation form with demo scenario support
- Is called through the AgentHive **secure proxy** (frontend never reaches you directly)
- Gets a live **health badge** polled every 60 seconds
- Has **every call logged** to the platform audit trail (with PII stripped per your manifest)
- Appears in the **Governance Dashboard** with latency and error metrics

**Supported service type:** Any FastAPI application — existing or new. The gateway only cares about three endpoints.

---

## 2. How It Works

```
User (browser)
     │
     │  POST /api/integrations/{product_id}/invoke
     ▼
AgentHive Backend (FastAPI)
     │  integrations/router.py
     │  ├── Validates InvokeRequest payload
     │  ├── Looks up ProductManifest from registry
     │  ├── Checks health status
     │  ├── Calls integrations/proxy.py
     │       ├── Enforces rate limit (token bucket)
     │       ├── Strips PII from inputs (for audit)
     │       ├── Injects auth headers (X-AgentHive-Key / Bearer)
     │       ├── Forwards to {base_url}/invoke via httpx (async)
     │       ├── Enforces timeout ({timeout_seconds}s)
     │       └── Normalises response → NormalisedResponse
     │  ├── Writes DecisionRecord + AuditLog to DB
     │  └── Returns NormalisedResponse
     │
     ▼
Your FastAPI Service
     └── POST /invoke → returns JSON matching contract
```

Your service is **never called directly by the browser**. All traffic goes through the AgentHive proxy.

---

## 3. API Contract Your Service Must Implement

You must expose exactly **3 endpoints** on your FastAPI service:

### 3.1 `GET /health`

Liveness check. Returns `200 OK` with:

```json
{ "status": "ok" }
```

**Minimum FastAPI implementation:**

```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

### 3.2 `GET /openapi.json`

Returns the OpenAPI JSON schema of your service. FastAPI generates this automatically at `/openapi.json` — no extra code needed.

The AgentHive Lab UI uses this to display field names and types in the invocation form.

### 3.3 `POST /invoke`

Main inference endpoint.

**Request body (sent by the proxy):**

```json
{
  "inputs": {
    "income": 45000,
    "employment_months": 18,
    "bank_account_age_days": 240
  },
  "demo_mode": false,
  "scenario_tag": null
}
```

| Field | Type | Description |
|---|---|---|
| `inputs` | `dict` | Arbitrary key-value pairs — define your own fields |
| `demo_mode` | `bool` | When true, return a pre-computed response without calling your model |
| `scenario_tag` | `str \| null` | Which demo scenario to return (matches `demo_scenarios[].tag` in manifest) |

**Required response shape:**

```json
{
  "decision_id": "a1b2c3d4-...",
  "decision": "approve",
  "summary": "Thin-file applicant approved — strong cash flow signals",
  "details": {
    "thin_file_score": 0.78,
    "cash_flow_index": 0.85,
    "bank_tenure_months": 24
  },
  "explanations": {
    "income_stability": 0.42,
    "deposit_frequency":  0.31,
    "bank_tenure": 0.18
  },
  "reason_codes": ["POSITIVE_CASH_FLOW", "STABLE_DEPOSITS"],
  "audit": {
    "model_version": "thinfile-v1.0.0",
    "timestamp": "2026-03-25T10:00:00Z",
    "latency_ms": 95
  }
}
```

**Field reference:**

| Field | Required | Description |
|---|---|---|
| `decision_id` | Recommended | UUID for this decision; proxy generates one if omitted |
| `decision` | **Required** | `approve`, `reject`, `review`, or any custom string |
| `summary` | **Required** | One-sentence headline shown in the OutputPanel |
| `details` | Optional | Key-value dict of model outputs (shown as a table) |
| `explanations` | Optional | Feature-level contributions (shown as a bar chart) |
| `reason_codes` | Optional | List of FCRA-style adverse action codes |
| `audit.model_version` | Optional | Artifact version string |
| `audit.timestamp` | Optional | ISO 8601 UTC; proxy fills now() if missing |
| `audit.latency_ms` | Optional | Your internal inference latency |

Any fields outside this contract are captured in `raw_extra` and shown in a collapsible block in the UI.

### 3.4 Minimal FastAPI `/invoke` Implementation

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Optional
import uuid, time
from datetime import datetime, timezone

app = FastAPI()

class InvokeRequest(BaseModel):
    inputs: dict[str, Any]
    demo_mode: bool = False
    scenario_tag: Optional[str] = None

DEMO_RESPONSES = {
    "thin_file_strong": {
        "decision": "approve",
        "summary": "Strong thin-file applicant — high cash flow index.",
        "details": {"thin_file_score": 0.82, "cash_flow_index": 0.91},
        "reason_codes": ["POSITIVE_CASH_FLOW", "LONG_BANK_TENURE"],
    },
    "thin_file_high_risk": {
        "decision": "reject",
        "summary": "Insufficient alternative data to approve.",
        "details": {"thin_file_score": 0.21, "cash_flow_index": 0.30},
        "reason_codes": ["VOLATILE_CASH_FLOW", "SHORT_BANK_TENURE"],
    },
}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/invoke")
def invoke(req: InvokeRequest):
    start = time.monotonic()

    if req.demo_mode:
        payload = DEMO_RESPONSES.get(req.scenario_tag or "thin_file_strong",
                                     DEMO_RESPONSES["thin_file_strong"])
    else:
        # ← Replace with your real model call
        score = run_your_model(req.inputs)
        payload = {
            "decision": "approve" if score > 0.5 else "reject",
            "summary": f"Score: {score:.2f}",
            "details": {"thin_file_score": score},
            "reason_codes": [],
        }

    latency = (time.monotonic() - start) * 1000
    return {
        "decision_id": str(uuid.uuid4()),
        **payload,
        "audit": {
            "model_version": "thinfile-v1.0.0",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "latency_ms": round(latency, 1),
        },
    }
```

---

## 4. Writing Your Manifest File

Create a YAML file at:

```
backend/integrations/registry/{your_product_id}.yaml
```

**Full example (ThinFile):**

```yaml
product_id: thinfile-applicant-v1
display_name: ThinFile Applicant Scorer
description: >
  ML-powered credit decisioning for thin-file applicants using alternative
  data signals — cash flow, bank tenure, and deposit stability.
category: credit

base_url: https://your-thinfile-api.example.com  # MUST be HTTPS in prod
health_check_path: /health
invoke_path: /invoke
schema_path: /openapi.json

auth_type: api_key           # none | api_key | oauth2 | mtls
auth_secret_env_var: THINFILE_API_KEY

copilot_enabled: true        # AI Copilot wraps your output with a narrative
demo_mode_supported: true
demo_scenarios:
  - tag: thin_file_strong
    label: "Strong Thin-File"
    description: "High cash-flow index — likely approve"
  - tag: thin_file_high_risk
    label: "High-Risk Thin-File"
    description: "Volatile signals — likely reject"

pii_fields: [ssn, date_of_birth, account_number]  # stripped before audit logging
data_residency: us-east-1
timeout_seconds: 30
rate_limit_rpm: 60
```

**Required fields:** `product_id`, `display_name`, `description`, `base_url`

All other fields have sane defaults (see [Appendix A](#appendix-a--full-manifest-reference)).

### product_id rules

- Lowercase alphanumeric + hyphens only
- Pattern: `^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$`
- Examples: `thinfile-applicant-v1`, `fraud-detector-v2`, `kyc-verifier`

---

## 5. Authentication Setup

### API Key (most common)

1. Set `auth_type: api_key` and `auth_secret_env_var: YOUR_ENV_VAR_NAME` in the manifest.
2. Add the key to your AgentHive backend `.env`:
   ```
   YOUR_ENV_VAR_NAME=sk-your-secret-key-here
   ```
3. The proxy injects:
   ```
   Authorization: Bearer sk-your-secret-key-here
   X-AgentHive-Key: sk-your-secret-key-here
   ```
4. Validate on your service side:
   ```python
   from fastapi import Header, HTTPException

   @app.post("/invoke")
   def invoke(req: InvokeRequest, x_agenthive_key: str = Header(...)):
       if x_agenthive_key != os.getenv("EXPECTED_KEY"):
           raise HTTPException(403, "Forbidden")
       ...
   ```

### OAuth2 Client Credentials

1. Set `auth_type: oauth2` and `auth_secret_env_var: YOUR_BEARER_TOKEN_VAR`.
2. Add the pre-fetched bearer token to `.env`. For production, implement token refresh in `integrations/proxy.py → _build_auth_headers`.

### No Auth (development only)

```yaml
auth_type: none
```

**Never use `none` in production.** The gateway will log a warning.

---

## 6. Running ThinFile Locally

### Start ThinFile on port 8001

```bash
# In your ThinFile service repo
uvicorn main:app --reload --port 8001
```

### Set the manifest base_url for local dev

The existing manifest (`thinfile-applicant-v1.yaml`) already points to `http://localhost:8001`.

### Set the auth key (or use none for dev)

In `backend/.env`:
```
THINFILE_API_KEY=dev-test-key
```

Or set `auth_type: none` in the manifest temporarily.

### Start the AgentHive backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Install pyyaml (required by the gateway)

```bash
pip install pyyaml==6.0.1
```

Or install from `requirements.txt`:
```bash
pip install -r requirements.txt
```

### Open the Lab UI

Navigate to `http://localhost:9002/lab/integrations` — ThinFile will appear in the list.

---

## 7. Registering Your Product

### Option A — YAML file (recommended)

Drop a manifest YAML in `backend/integrations/registry/` and restart the server. The registry loads all manifests on startup.

```bash
cp my-product.yaml backend/integrations/registry/
# restart backend
```

### Option B — Admin API (no restart needed)

```bash
curl -X POST http://localhost:8000/api/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "product_id": "thinfile-applicant-v1",
      "display_name": "ThinFile Applicant Scorer",
      "description": "Alternative data credit scoring for thin-file applicants.",
      "base_url": "http://localhost:8001",
      "auth_type": "none",
      "copilot_enabled": true,
      "demo_mode_supported": true,
      "demo_scenarios": [
        {"tag": "thin_file_strong", "label": "Strong Thin-File", "description": ""}
      ]
    }
  }'
```

Response: `201 Created` with the `ProductSummary`.

### Deregister

```bash
curl -X DELETE http://localhost:8000/api/integrations/thinfile-applicant-v1
```

---

## 8. Testing the Integration

### 8.1 Test the health endpoint

```bash
curl http://localhost:8000/api/integrations/thinfile-applicant-v1
```

Expected: `health_status` field in the response (may be `"unknown"` until the first poll at 60s, or run a quick test immediately).

### 8.2 Test invoke — demo mode

```bash
curl -X POST http://localhost:8000/api/integrations/thinfile-applicant-v1/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {},
    "demo_mode": true,
    "scenario_tag": "thin_file_strong"
  }'
```

Expected: `200 OK` with a `NormalisedResponse`.

### 8.3 Test invoke — live mode

```bash
curl -X POST http://localhost:8000/api/integrations/thinfile-applicant-v1/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "income": 45000,
      "employment_months": 18,
      "bank_account_age_days": 240
    },
    "demo_mode": false
  }'
```

### 8.4 List all integrations

```bash
curl http://localhost:8000/api/integrations
```

### 8.5 Fetch schema

```bash
curl http://localhost:8000/api/integrations/thinfile-applicant-v1/schema
```

### 8.6 View in Swagger UI

```
http://localhost:8000/api/docs
```

All `/api/integrations` routes are documented under the **Integrations** tag.

---

## 9. Governance — What Gets Logged

Every proxied call writes:

**`DecisionRecord` row:**

| Column | Value |
|---|---|
| `decision` | The decision string from the normalised response |
| `input_payload` | `inputs{}` with PII fields replaced by `<REDACTED>` |
| `reason_codes` | From the normalised response |
| `model_version` | From `audit.model_version` |
| `risk_segment` | Set to `{product_id}` (re-purposed column) |
| `demo_mode` | From the request |

**`AuditLog` row:**

| Column | Value |
|---|---|
| `event_type` | `external_invoke` |
| `actor` | `integration:{product_id}` |
| `metadata_` | `{product_id, latency_ms, scenario_tag, source: "external"}` |

These appear in:
- `GET /api/underwriting/history` (filtered by `risk_segment=thinfile-applicant-v1` to isolate)
- The Governance Dashboard decision log

### PII Scrubbing

Fields listed in the manifest `pii_fields` are **replaced with `<REDACTED>`** before the input payload is persisted. They are never stored in plaintext.

```yaml
pii_fields: [ssn, date_of_birth, account_number, full_name]
```

---

## 10. Health Monitoring

The health monitor (`integrations/health_monitor.py`) runs as a background asyncio task.

**Poll cycle:** Every 60 seconds.

**Status transitions:**

| Condition | Status |
|---|---|
| `/health` returns `{"status": "ok"}` | `healthy` |
| 1 consecutive failure | `degraded` |
| 2+ consecutive failures | `down` |
| Back to healthy after down | `healthy` (with recovery log at `WARNING` level) |

**On `down` transition:** `_alert_down()` is called. By default this logs a `CRITICAL` message. Wire it to Slack/PagerDuty/SES in `health_monitor.py → _alert_down()`.

**In the Lab UI:** Each product card shows a live health badge (Healthy / Degraded / Down / Unknown).

---

## 11. Rate Limits & Timeouts

Both are configurable per product in the manifest:

```yaml
timeout_seconds: 30    # max time to wait for your /invoke response (1–120)
rate_limit_rpm: 60     # max requests per minute per product (token bucket)
```

**On timeout:** The proxy returns `504 Upstream Timeout` to the client.

**On rate limit exceeded:** The proxy returns `429 Rate Limit Exceeded`.

**Current implementation:** In-memory token bucket per process. For multi-process deployments, replace `_rate_limiters` in `proxy.py` with Redis INCR + EXPIRE.

---

## 12. Troubleshooting

### Product shows "Unknown" health status

The health monitor polls every 60 seconds. Wait up to 60s after startup. Or check that:
- `base_url` is reachable from the AgentHive backend host
- `health_check_path` returns `{"status": "ok"}`

### 502 Bad Gateway on invoke

Check the logs for:
```
Upstream error from {product_id}: HTTP 4xx/5xx
```

Common causes:
- Wrong `auth_secret_env_var` or missing env var → check `.env`
- `base_url` not reachable → check firewall / VPN
- `/invoke` endpoint not implemented correctly on your service

### 422 Unprocessable Entity on manifest load

The YAML manifest failed Pydantic validation. The error message in the server logs names the exact field. Common issues:
- `product_id` contains uppercase or spaces
- `base_url` uses HTTP (not HTTPS) for non-localhost
- Missing required field

### "Contract Violation" error

Your `/invoke` response is missing `decision` or `summary`. Both are required.

### Rate limit hit immediately

Default is 60 rpm. Increase in the manifest:
```yaml
rate_limit_rpm: 300
```

---

## 13. Production Checklist

Before deploying a new external integration to production:

- [ ] `base_url` uses HTTPS (not HTTP)
- [ ] `auth_type` is not `none`
- [ ] `auth_secret_env_var` is set in production secrets (not in the manifest YAML)
- [ ] `pii_fields` lists all fields containing personal data
- [ ] `data_residency` is set correctly
- [ ] `/health` returns within 2 seconds
- [ ] `/invoke` returns within `timeout_seconds` under P95 load
- [ ] Demo scenarios tested with `demo_mode: true`
- [ ] `_alert_down()` wired to Slack/PagerDuty in `health_monitor.py`
- [ ] Manifest YAML committed to source control (without secrets)
- [ ] Rate limit (`rate_limit_rpm`) reviewed with capacity team
- [ ] Governance team notified (product appears in decision audit trail)

---

## Appendix A — Full Manifest Reference

```yaml
# ── Required ──────────────────────────────────────────────────────────────────
product_id: string          # ^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$
display_name: string        # max 80 chars
description: string         # max 500 chars
base_url: string            # HTTPS URL (localhost allowed for dev)

# ── Routing (defaults shown) ──────────────────────────────────────────────────
health_check_path: /health
invoke_path: /invoke
schema_path: /openapi.json

# ── Identity ──────────────────────────────────────────────────────────────────
category: external          # credit | fraud | kyc | income | external

# ── Auth ─────────────────────────────────────────────────────────────────────
auth_type: api_key          # none | api_key | oauth2 | mtls
auth_secret_env_var: null   # name of env var holding the secret

# ── Behaviour ─────────────────────────────────────────────────────────────────
copilot_enabled: false
demo_mode_supported: true
demo_scenarios: []          # list of {tag, label, description}

# ── Compliance ────────────────────────────────────────────────────────────────
pii_fields: []              # list of input field names to redact in audit log
data_residency: us-east-1

# ── SLA ───────────────────────────────────────────────────────────────────────
timeout_seconds: 30         # 1–120
rate_limit_rpm: 60          # 1–6000
```

---

## Appendix B — FastAPI Minimal Template

Copy-paste this template to make any Python function AgentHive-compatible in under 10 minutes:

```python
"""
AgentHive-compatible FastAPI service — minimal template.

Replace the `run_model()` stub with your actual inference code.
"""
import os
import uuid
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(
    title="My AI Product",
    description="AgentHive-compatible AI service",
    version="1.0.0",
)

# ── Auth ──────────────────────────────────────────────────────────────────────
EXPECTED_KEY = os.getenv("MY_PRODUCT_API_KEY", "")

def verify_key(x_agenthive_key: str = Header(default="")) -> None:
    if EXPECTED_KEY and x_agenthive_key != EXPECTED_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

# ── Schemas ───────────────────────────────────────────────────────────────────
class InvokeRequest(BaseModel):
    inputs: dict[str, Any]
    demo_mode: bool = False
    scenario_tag: Optional[str] = None

# ── Demo responses ────────────────────────────────────────────────────────────
DEMO = {
    "approve_scenario": {
        "decision": "approve",
        "summary": "Strong applicant profile — approved.",
        "details": {"score": 0.85},
        "reason_codes": ["STRONG_PROFILE"],
    },
    "reject_scenario": {
        "decision": "reject",
        "summary": "Insufficient data to approve.",
        "details": {"score": 0.22},
        "reason_codes": ["INSUFFICIENT_DATA"],
    },
}

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/invoke")
def invoke(req: InvokeRequest, _: None = None):  # add Depends(verify_key) to enable auth
    t0 = time.monotonic()

    if req.demo_mode:
        payload = DEMO.get(req.scenario_tag or "approve_scenario", DEMO["approve_scenario"])
    else:
        # ← Replace with your real model
        result = run_model(req.inputs)
        payload = {
            "decision": result["decision"],
            "summary": result["summary"],
            "details": result.get("details", {}),
            "explanations": result.get("explanations", {}),
            "reason_codes": result.get("reason_codes", []),
        }

    latency = (time.monotonic() - t0) * 1000
    return {
        "decision_id": str(uuid.uuid4()),
        **payload,
        "audit": {
            "model_version": "v1.0.0",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "latency_ms": round(latency, 1),
        },
    }


def run_model(inputs: dict) -> dict:
    """Stub — replace with your actual model inference."""
    score = float(inputs.get("score", 0.5))
    return {
        "decision": "approve" if score >= 0.5 else "reject",
        "summary": f"Model score: {score:.2f}",
        "details": {"score": score},
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

**Run:**
```bash
pip install fastapi uvicorn
python main.py
# → http://localhost:8001
```

**Quick test:**
```bash
curl http://localhost:8001/health
curl -X POST http://localhost:8001/invoke \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"score": 0.8}, "demo_mode": false}'
```
