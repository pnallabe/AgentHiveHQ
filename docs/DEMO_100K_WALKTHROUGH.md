# Demo Walkthrough — "100,000 Applications, One Exam Package"

**Purpose:** a step-by-step script for showing a prospect how a fictional
mid-market lender runs 100k applications through AgentHive and walks away with
an examiner-ready SR 11-7 package — in minutes, not months.

**The fictional client:** *Meridian Financial* — a (fictional) $1.2B fintech
lender with 100,000 applications to decision, ~30% of them thin-file.

**Runtime:** ~5 minutes on stage. **What the prospect sees:** the whole
governance story, live, with a real fair-lending catch at the end.

---

## Why this demo lands

Every competitor shows a *decision*. We show a decision **and the audit trail
that survives an exam** — then generate the exam package in front of them. The
kicker: the fictional book has a genuine disparate-impact signal, and AgentHive
*catches it*. That's the moment a CRO leans forward.

---

## Pre-flight (before the prospect is on the call)

```bash
# 1. Generate the fictional client's application file (one time, ~5s)
cd backend
.venv/bin/python scripts/generate_fictional_client.py \
    --out data/demo_client_100k.csv --n 100000
# → 100,000 applications, 30% thin-file, realistic income/employment mix
```

Have the file ready to drag-and-drop. Have the governance dashboard open in
another tab.

---

## The script

### Step 1 — Set the scene (30s)
> "Meridian Financial has 100,000 applications. About a third are thin-file —
> people the bureaus can't score. Their MRM team needs every one of these
> decisions to be explainable and exam-ready. Watch how that actually works."

Show the CSV: `applicant_ref, income, employment_length, housing_status, credit_score`
— point out the **blank credit_score cells** (the thin-file applicants).

### Step 2 — Run 100,000 decisions (60s, the "wow" beat)
Upload the CSV to the batch endpoint:

```bash
curl -X POST "$BASE/api/underwriting/decision/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/demo_client_100k.csv"
```

**Result in ~28 seconds:**
```json
{
  "total_rows": 100000,
  "processed": 100000,
  "approved": 69677,
  "rejected": 25540,
  "reviewed": 4783,
  "failed": 0,
  "approval_rate": 0.6968,
  "elapsed_seconds": 28.34
}
```

> "100,000 decisions in under 30 seconds. Every single one — including the
> thin-file applicants a bureau model would have auto-declined — got a real,
> explainable decision. And every one wrote an immutable audit record *at the
> moment of the decision*."

**Key line:** the audit trail isn't assembled later — it's written *with* the
decision. That's why the exam package is fast and why it can't be cherry-picked.

### Step 3 — Show the governance dashboard (60s)
Open `/lab/governance`. Point at:
- **Approval rate by segment** — prime 99.5%, near-prime 94.7%, thin-file 0.7%.
- **Decision history** — scroll the audit table; each row has model version,
  timestamp, reason codes.
- **Bias report** — the four-fifths-rule panel.

### Step 4 — Generate the exam package, live (60s, the close)
```bash
curl -X GET "$BASE/api/governance/exam-package" \
  -H "Authorization: Bearer $TOKEN"
```

> "This is the document their examiner gets. Model inventory, validation
> evidence, the full audit trail — generated from the live data we just created,
> in seconds. Their MRM team's 6-week documentation scramble becomes a button."

### Step 5 — The catch (the moment that sells governance) ⭐
The exam package for this fictional book returns:

```
adverse_impact_ratio: 0.7632
disparate_impact_flag: true   ← below the 0.80 four-fifths threshold
```

> "Notice what just happened. The system flagged a potential disparate-impact
> issue in Meridian's book — thin-file applicants are being approved at 0.76×
> the rate of the highest-income band, which is *below* the 80% four-fifths
> threshold a regulator applies. **AgentHive caught this before the examiner
> did.** That's the difference between finding a fair-lending issue in your own
> dashboard and finding it in a consent order."

This is the entire pitch in one moment: **governance isn't a report you
scramble to build — it's a signal the platform surfaces continuously.**

---

## What the prospect just saw (and why it's credible)

| Claim | Proven by |
|---|---|
| 100k decisions in seconds | The batch run, live |
| Thin-file applicants get real decisions | 30% of the file had no credit score |
| Every decision is auditable | The audit table + exam package from the same data |
| Exam package in minutes, not months | Generated live in front of them |
| Continuous fair-lending monitoring | The disparate-impact flag it *caught* |
| Customer owns the model & the data | Tenant-scoped records; they export their own trail |

---

## Honesty notes (say these if asked)

- **The 100k file is synthetic** — generated to look like a real mid-market
  book. Say so. It makes the fair-lending catch *more* impressive, not less
  (the signal was planted by the data distribution, and the system found it).
- **SHAP is computed per-decision in the live path;** in the bulk fast path it's
  computed for a sample (the exam package aggregates decisions/segments/reason
  codes, so it's unaffected). If a prospect asks about per-row SHAP at 100k
  scale, that's the honest answer.
- **The disparate-impact flag is real output**, not staged — it falls out of the
  four-fifths calculation on the synthetic book.

---

## Follow-up CTA

> "Want us to run *your* book? Send us a de-identified extract — income,
> employment, housing, optional score — and we'll run it through the same
> pipeline and hand you the exam package. That's the pilot."

That is the design-partner ask, and it leads directly to the Phase 2 North Star:
one real lender, one real exam, one passed audit.
