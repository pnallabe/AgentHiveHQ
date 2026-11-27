# AgentHive — Customer Workflow & Trust Model

**Audience:** prospects, design partners, new team members
**Purpose:** explain, end to end, how a customer interacts with the platform,
where their data goes, how it's protected, how the audit package is produced,
and why they can trust its accuracy.
**Status:** grounded in the live system (`backend/app/modules/*`). Gaps vs. the
marketing narrative are flagged explicitly as **[roadmap]**.

---

## 1. The customer journey at a glance

```
Onboard (tenant provisioned)
   │
   ▼
Send applicant data ──► Decision API ──► Decision + SHAP + reason codes
   (per applicant,        (RuleSense)         │
    via API/LOS)                               │
                                               ▼
                              Immutable audit log written at decision time
                                               │
                                               ▼
                        Governance dashboard (live monitoring, bias alerts)
                                               │
                                               ▼
                        One-click exam package (SR 11-7 MVR) for the examiner
```

The key design principle: **the audit trail is not assembled after the fact —
it is written at the moment of the decision.** That is what makes the exam
package trustworthy and fast.

---

## 2. How a customer interacts with the platform

### 2.1 Onboarding
- A **tenant** is provisioned for the lender (isolated namespace for all their
  data). The customer's team gets accounts (Firebase Auth; SSO/SAML available
  **[roadmap]** for enterprise).
- A tenant-scoped **API key** is issued for system-to-system calls.

### 2.2 Two ways to use it

**A. Embedded (the real deployment).** The customer's Loan Origination System
(LOS) or app calls the decision API on each application:

```
POST /api/underwriting/decision
Authorization: Bearer <token>   (or tenant API key)
{
  "income": 75000,
  "employment_length": 3,
  "housing_status": "mortgage",
  "credit_score": null          // omitted for thin-file applicants
}
```

Response (same call):
```json
{
  "decision": "review",
  "limit": 5000,
  "apr": 18.5,
  "reason_codes": [{ "code": "THIN_CREDIT_HISTORY", "fcra_code": "AA-..", "description": "..." }],
  "explanations": { "income_stability": 0.31, "dti_ratio": -0.18 },
  "audit": { "model_version": "rulesense-v2.4.1", "timestamp": "2026-11-26T14:03:11Z", "latency_ms": 42 }
}
```

**B. Governance dashboard (web UI).** Model-risk and compliance staff log in to
see approval rates by segment, decision history, the bias report, and to
generate the exam package. No engineering required for the governance side.

### 2.3 The public demo (marketing site)
The `/lab` on the website runs against a **separate public endpoint**
(`POST /api/underwriting/decision/demo`) that is hard-locked to `demo_mode=True`
— it only serves pre-computed synthetic scenarios and **never** touches live
inference or any tenant's data. This is a hard boundary, enforced in code.

---

## 3. Where does the customer's data go?

**There is no bulk "upload your loan book" step for decisioning.** Data flows
per-decision:

| Data | When | Where it goes |
|---|---|---|
| Applicant profile (income, employment, housing, optional credit score) | Sent with each `POST /decision` | Persisted as a `DecisionRecord`, **scoped to the customer's tenant** |
| Decision output + SHAP + reason codes | Produced in the same call | Same `DecisionRecord` + an `AuditLog` entry |
| Portfolio benchmarks (Freddie Mac SFLLD) | Reference only | Public dataset in BigQuery — **not** customer data |

**Tenant isolation is structural, not a filter:** every governance query is
scoped by `tenant_id`, and a tenant's records are never mixed with another
tenant's or with sandbox/demo records. Demo records (`demo_mode=True`) are
excluded from all governance metrics by construction.

> **[Roadmap] Bulk / batch decisioning** (upload a CSV of applications for
> back-testing or a portfolio review) is a natural extension of the same
> per-decision pipeline — each row becomes a tenant-scoped `DecisionRecord`.
> Not yet exposed as a self-serve endpoint.

---

## 4. How we safeguard privacy

1. **Minimal PII by design.** The decision schema takes financial attributes
   (income, employment length, housing status, optional credit score) — **not**
   name, SSN, DOB, or account numbers. The model doesn't need them, so we don't
   take them.
2. **Tenant isolation.** Per-tenant data partitioning; members can only ever
   read/export their own tenant's records (enforced at the query layer).
3. **Encryption in transit & at rest.** TLS 1.2+ in transit; Cloud SQL /
   cloud-provider encryption at rest.
4. **Secrets management.** All credentials (SMTP, LLM keys, DB URL) live in
   GCP Secret Manager — never in code or env files in the repo.
5. **Access control.** Firebase Auth on every authenticated endpoint; the public
   demo endpoint is firewalled to synthetic data only.
6. **No PII in logs.** The proxy/log layer does not store PII fields without
   explicit opt-in.

> **[Roadmap] Formal attestations:** SOC 2 Type II and a published data-processing
> agreement (DPA) are Phase 3 items. Today the *technical* controls above are in
> place; the *audited paperwork* is not yet.

---

## 5. How the audit package is generated

The exam package is **not a hand-built PDF.** It is a JSON document assembled on
demand by `GET /api/governance/exam-package`, which queries the same live tables
the decisioning system writes to:

| MVR section | Source (live) |
|---|---|
| **1. Model inventory & intended use** | Model registry + observed decision segments |
| **2. Validation evidence** | `GovernanceDashboardService` — 90-day performance (approval rate by segment/day, avg limit/APR) **+** `bias_report` — four-fifths-rule adverse-impact ratio across income bands |
| **3. Governance controls & audit trail** | The tenant-scoped `AuditLog` ⨝ `DecisionRecord` export (the same query behind `/tenants/me/audit-export`) |

Because it's generated from the live decision log at request time, the package
is always current — there is no stale snapshot to reconcile.

---

## 6. How the customer is assured of its accuracy

This is the crux of the trust model. Five mechanisms:

1. **Write-time integrity.** The audit record is created *in the same
   transaction* as the decision. You cannot have a decision without its audit
   trail — so the package can't omit decisions that happened.
2. **Immutability.** Audit entries are append-only and hash-chained with ISO
   8601 timestamps. There is no "edit history" — any tampering breaks the chain.
3. **Reproducibility.** Every record carries the `model_version` and the input
   payload hash. An examiner (or the customer) can re-run the same input against
   the same model version and confirm the same output.
4. **Tenant-scoped by construction.** The customer exports *their own* records
   directly — AgentHive can't cherry-pick or pre-filter what the examiner sees.
   The export is the ground truth of their decisions.
5. **Live, not static.** Because the package is generated on demand, the customer
   can generate it *today*, hand it to the examiner, and regenerate it *during*
   the exam to show the numbers reconcile.

**The honest framing for a skeptic:** "Don't trust our summary — pull your own
audit export and check it against your LOS records. They will match, because
they're the same events."

---

## 7. What "one real exam" would prove (the Phase 2 goal)

The entire trust model above is technically sound but currently **unproven in a
regulatory exam.** The North Star is a design partner who:

1. Onboards as a tenant,
2. Runs real (or shadow) decisions through the API,
3. Generates the exam package,
4. Presents it in an actual OCC/CFPB/state exam — and passes.

That single outcome converts every claim in this document from "the system is
designed to" into "a lender did." It is the top priority of Phase 2.

---

## Appendix — Honesty ledger (marketing vs. reality)

| Claim | Reality today |
|---|---|
| "One-click exam package" | ✅ Real — `/api/governance/exam-package` generates from live data |
| "Immutable, hash-chained audit log" | ✅ Append-only + versioned; hash-chaining implemented at the record level |
| "Continuous bias monitoring" | ✅ Real — four-fifths rule over income bands, auto-flag < 0.80 |
| "Tenant isolation" | ✅ Real — enforced at query layer |
| "SOC 2" | ⚠️ Controls aligned; **Type II audit not yet completed** |
| "SSO / SAML" | ⚠️ Firebase Auth today; enterprise SSO **[roadmap]** |
| "Bulk CSV upload" | ⚠️ Per-decision API today; batch **[roadmap]** |
| "Passed a real exam" | ❌ Not yet — the Phase 2 North Star |
