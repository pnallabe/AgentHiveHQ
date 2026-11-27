# PRD: AgentHive — Governance-Native Credit Decisioning Platform

**Version:** 2.0 · **Date:** November 2026 · **Status:** Active
**Supersedes:** PRD v1.0 (AI Product Lab / portfolio framing — see `PRD.v1.backup.md`)
**Aligned to:** `docs/PMF_ANALYSIS_AND_REBRANDING.md`

---

## 1. Product Overview

**Product Name:** AgentHive
**Category:** Governance-native credit decisioning infrastructure
**One-liner:** *Pass your next model-risk exam in weeks, not years.*

AgentHive is the compliance layer for AI lending. It lets regulated lenders
approve thin-file borrowers with machine-learning models they **own, explain,
and defend** — and generates the SR 11-7 audit package to prove it, on demand,
from live decisioning data.

**Primary buyer (single ICP):** Head of Model Risk / Chief Risk Officer at a
mid-market fintech lender ($100M–$5B AUM) deploying AI underwriting without the
MRM infrastructure to do it compliantly.

**What AgentHive is NOT:**
- Not a consulting portfolio or demo reel (v1.0 framing — removed)
- Not a black-box model-as-a-service (that's Upstart/Zest — we are the opposite)
- Not a demo-hosting platform for third-party AI products (the Integration
  Gateway is internal plumbing, not a market-facing pillar)

---

## 2. Problem Statement

Mid-market lenders face a three-way bind:

1. **Thin-file gap.** 45M Americans are credit-invisible; bureau scores fail
   them. Lenders leave 10–25% incremental approvals on the table.
2. **Governance gap.** SR 11-7 model validation takes 9–18 months and MRM teams
   spend ~800 hours/year hand-assembling audit documentation. OCC exam failure
   rate on model governance is ~40%.
3. **Control gap.** Model-as-a-service vendors (Upstart, Zest) run the model for
   you — but then *you* bear the credit risk while *they* hold the model, and
   your MRM team can't govern a black box. Post-CFPB disparate-impact scrutiny,
   CROs are wary of this arrangement.

**No incumbent solves decisioning AND governance as a unified, customer-owned
system.** AgentHive does.

---

## 3. Objectives & Success Metrics

### Business objectives
- Convert the artifact-led funnel: sample audit package → demo → paid pilot.
- Land 1–2 design-partner lenders and drive **one real exam passed** with an
  AgentHive-generated audit package (the PMF unlock).
- Establish AgentHive as the governance-native category leader before incumbents
  rebrand their compliance slides (12–24 month window).

### Product metrics
| Metric | Target |
|---|---|
| Sample audit package downloads (gated) | Primary top-of-funnel KPI |
| Demo requests from audit-package page | > 2× old "book demo" CTR |
| Exam-package generation time | < 5 minutes from live data |
| Decision latency (p95) | ≤ 500 ms |
| Adverse-impact monitoring coverage | 100% of decisions |

---

## 4. User Personas

### 1. Head of Model Risk / CRO (primary buyer)
- **Wants:** A defensible, examiner-ready audit trail; to pass SR 11-7 without
  hiring a Big 4 engagement.
- **Concern:** Model risk, disparate impact, exam findings.
- **AgentHive value:** One-click exam package; continuous bias monitoring;
  customer-owned models.

### 2. Fintech Product / Lending Leader (economic buyer)
- **Wants:** Approve more thin-file borrowers; faster time-to-market.
- **Concern:** Approval rates, default risk, speed.
- **AgentHive value:** RuleSense thin-file underwriting with explainable,
  compliant decisions.

### 3. Platform Administrator (internal champion / operator)
- **Wants:** Control over models, visibility into every decision, no data leakage.
- **Concern:** Audit coverage, access control, reliability.
- **AgentHive value:** Tenant-scoped governance dashboard, immutable audit log.

> **Removed from v1.0:** "External AI Builder" and the third-party integration
> persona. The Integration Gateway remains as internal infrastructure (§9) but
> is no longer a target customer or a marketing surface.

---

## 5. Core Features (priority-ordered)

### Feature 1 — Audit Fabric (the wedge) ⭐
Automated compliance infrastructure. **This is the lead product.**

- **One-click exam package** (`GET /api/governance/exam-package`): generates a
  complete SR 11-7 Model Validation Report from live data — model inventory,
  validation evidence (performance + four-fifths fair-lending), and the
  immutable audit trail.
- **Immutable decision log:** every decision persisted with model version, input
  payload hash, and SHAP values; hash-chained, ISO 8601, tenant-scoped.
- **Continuous fair-lending monitoring:** four-fifths (80%) rule adverse-impact
  ratio across income bands with automated flag below 0.80.
- **Model registry:** version tracking with deploy timestamps.

### Feature 2 — RuleSense Underwriting Engine (the engine)
Production-grade thin-file decisioning.

- Income-first ML scoring (cash-flow, income stability, payment consistency —
  not bureau-dependent) with monotonic constraints for compliance.
- Calibrated PD; outputs approve/decline/review + credit limit + APR.
- SHAP-derived, FCRA/ECOA-aligned adverse-action reason codes in real time.
- AUC 0.72–0.78 on thin-file populations where FICO fails.

### Feature 3 — Governance Dashboard (the proof surface)
The live, examiner-facing view.

- Approval rate by segment and by day; decision history; bias report.
- Exam-readiness indicators; one-click audit export.
- **The demo reframed:** "See a decision the way your examiner will" — every
  demo output shows the audit trail, not just the decision.

### Feature 4 — AI Copilot (supporting)
LLM narrative over decisions for non-technical stakeholders (regulators, loan
officers, compliance). Wraps RuleSense output; never a standalone selling point.

### Feature 5 — Lead Conversion (artifact-led)
- **Primary CTA:** "Get a Sample Audit Package" → gated download of a real
  (synthetic-data) MVR → email capture → demo.
- **Secondary:** "Request a Demo" → tenant-inquiry form → personal reply.
- Case studies framed as exam/compliance outcomes, not portfolio pieces.

---

## 6. User Journey (artifact-led funnel)

```
Homepage hero: "Pass Your Next Model-Risk Exam. In Weeks, Not Years."
  └─ CTA: "Get a Sample Audit Package"
       └─ /audit-package — see the 3 MVR sections
            └─ gated form (name/email/company)
                 └─ POST /api/v1/sample-audit-package
                      ├─ emails prospect the sample MVR (Reply-To: founder)
                      ├─ persists lead (referral=audit-package-download)
                      └─ notifies founder inbox
            └─ secondary: "See the Live Dashboard" → /lab/governance
  └─ Demo: run /api/governance/exam-package live on a tenant
       └─ "Want this for your book?" → paid pilot
```

---

## 7. Data Strategy

- **Synthetic generation** (primary demo data) — clearly labeled.
- **Freddie Mac SFLLD** (BigQuery) for portfolio benchmarks.
- **Tenant decision data** — persisted per-tenant, never mixed; demo-mode
  records excluded from all governance metrics.
- **PII hygiene:** no PII stored in the proxy/log layer without explicit opt-in.

---

## 8. Governance & Compliance (the product, not a checkbox)

AgentHive is purpose-built to generate the evidence artifacts regulators require:

| Regulation | AgentHive coverage |
|---|---|
| **SR 11-7 / OCC 2011-12** | Model inventory, validation evidence, ongoing monitoring, audit trail — auto-generated exam package |
| **ECOA / Reg B** | Adverse-action reason codes on every decline |
| **FCRA §615** | Compliant reason codes; permissible-purpose logging |
| **CFPB UDAAP** | Explainable decisions; consumer-readable reasons |
| **HMDA / fair lending** | Continuous four-fifths disparate-impact monitoring |

**Exam-readiness posture:** every claim on the marketing site maps to a real,
queryable system output. The sample MVR is generated by the same code path as a
production exam package.

---

## 9. Technical Architecture

### Frontend (Next.js)
- Marketing site (hero → audit-package → gated download), Product Lab,
  Governance Dashboard, Case Studies, Pricing.
- The Lab is reframed as *proof of governance*, not a product playground.

### Backend (FastAPI)
- `POST /api/underwriting/decision` — RuleSense native decisioning.
- `GET /api/governance/dashboard` · `/bias-report` · `/exam-package` — Audit Fabric.
- `POST /api/v1/tenant-inquiries` · `/sample-audit-package` — lead capture + SMTP notify.
- `GET /api/v1/tenants/me/audit-export` — tenant-scoped audit trail.

### Integration Gateway (internal plumbing — not market-facing)
The FastAPI proxy/registry (`/api/integrations`) remains as internal
infrastructure for first-party and partner models, governed identically to
native products (every call logged, bias monitoring applies). It is **not** a
marketing pillar and has no dedicated buyer. Self-serve registration and the
public SDK are deferred until after 3+ paying governance customers.

### Deployment
- Frontend: Firebase Hosting / Cloud Run (Next.js).
- Backend: Cloud Run; Cloud SQL Postgres; Secret Manager for SMTP/LLM keys.
- Artifact-led email via stdlib SMTP (Gmail app password); swappable to
  Resend/SendGrid at volume.

---

## 10. API Design (public surface)

### Decisioning
`POST /api/underwriting/decision`
```json
// Request
{ "income": 75000, "employment_length": 3, "credit_score": null }
// Response
{ "decision": "approve", "limit": 5000, "apr": 18.5, "reason_codes": ["low_credit_history"] }
```

### Audit Fabric
```
GET /api/governance/dashboard?period=last_90_days
GET /api/governance/bias-report
GET /api/governance/exam-package        # one-click SR 11-7 MVR (auth)
GET /api/v1/tenants/me/audit-export     # tenant-scoped trail (auth)
```

### Lead capture (public)
```
POST /api/v1/tenant-inquiries           # demo request
POST /api/v1/sample-audit-package       # gated MVR download
```

---

## 11. Roadmap (re-sequenced around the wedge)

### Phase 1 — Proof artifacts ✅ (done)
- Exam-package generator (`/api/governance/exam-package`) from live data.
- Public `/audit-package` page + gated sample download.
- Artifact-led funnel + email notification.

### Phase 2 — First proof (current)
- Land 1–2 design-partner lenders.
- Run **one real exam** with an AgentHive-generated package; publish anonymized
  case study with the examiner outcome.
- LOS integration story (MeridianLink-ready; Symitar on roadmap).

### Phase 3 — Hardening
- SOC 2 Type II; SSO/SCIM; private-deployment option.
- Model registry UI; exam-readiness score widget on the dashboard.

### Phase 4 — Expand (only after 3+ paying governance customers)
- Fraud module (native); line-increase optimization.
- Revisit Integration Gateway as a public pillar / self-serve SDK.

---

## 12. Success Metrics (rewritten)

### North Star
**Exams passed with AgentHive-generated audit packages.** (Currently 0 → target 1.)

### Funnel
| Stage | Metric |
|---|---|
| Awareness | Homepage → /audit-package CTR |
| Capture | Sample MVR downloads (gated) |
| Activation | Demo requests; exam-package generated in a live demo |
| Revenue | Paid pilots; pilot → platform conversion |

### Product health
- Exam-package generation < 5 min · decision p95 ≤ 500 ms · bias coverage 100%.

---

## 13. Out of Scope (explicitly)

- Self-serve third-party product registration portal (deferred).
- Public `agenthive-sdk` for external FastAPI teams (deferred).
- Credit-union-specific GTM (Scienaptic owns that channel; we target fintech lenders).
- Black-box model-as-a-service (philosophically opposed — customers own their models).

---

## Appendix A — Consistency check: PRD vs. live site

| PRD claim | Live site surface | Status |
|---|---|---|
| "Pass your next model-risk exam in weeks, not years" | Hero H1 | ✅ Consistent |
| Audit Fabric is the lead product | Products grid leads with Audit Fabric | ✅ Consistent |
| One-click exam package | `/api/governance/exam-package` live (401 auth) | ✅ Consistent |
| Sample audit package gated download | `/audit-package` + `POST /sample-audit-package` (201) | ✅ Consistent |
| Artifact-led CTA | Hero "Get a Sample Audit Package" → /audit-package | ✅ Consistent |
| Customer-owned models (not black-box) | Hero sub + products copy | ✅ Consistent |
| Integration Gateway = internal plumbing | Not on homepage; docs behind auth | ✅ Consistent |
| Single ICP: mid-market fintech lender CRO | Copy targets model-risk/compliance buyer | ✅ Consistent |
| Pricing signal | Pricing section live ($499 / $1,999 / Custom) | ✅ Present |
| LOS integrations | `/integrations` page live (MeridianLink/Origence/Temenos ready; Symitar/Fiserv/Corelation/Sync1 roadmap) | ✅ Consistent |
| Named case studies / real exam proof | Case studies are illustrative | ⚠️ Gap — Phase 2 goal (design-partner outreach via `docs/OUTREACH.md`) |
