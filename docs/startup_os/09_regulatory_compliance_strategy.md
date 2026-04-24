# AgentHive — Regulatory & Compliance Strategy

**Version:** 1.0 | **Date:** April 2026  
**Owner:** Chief Compliance Officer / CEO  
**Audience:** Regulators, Investors, Compliance Leads, Enterprise Prospects  
**Classification:** Public-facing (sanitized version)

---

## 1. Regulatory Framework Coverage

AgentHive is purpose-built to address the complete regulatory stack applicable to AI-powered consumer credit decisioning in the United States. The platform is not merely "compliant with" these frameworks — it actively generates the evidence artifacts required to demonstrate compliance.

| Regulation | Regulator(s) | AgentHive Coverage |
|---|---|---|
| **SR 11-7** — Supervisory Guidance on Model Risk Management | Federal Reserve, OCC | ✅ MDR, MVR, Model Card auto-generation; model inventory; ongoing monitoring |
| **ECOA / Regulation B** — Equal Credit Opportunity Act | CFPB, OCC | ✅ SHAP-derived adverse action reasons; Reg B notice templates; disparate impact testing |
| **FCRA** — Fair Credit Reporting Act | FTC, CFPB | ✅ Adverse action reason codes compliant with FCRA requirements; bureau data flags |
| **HMDA** — Home Mortgage Disclosure Act | CFPB, FFIEC | ✅ HMDA-format loan-level data export; rate-spread disparity analysis |
| **CFPB UDAP/UDAAP** | CFPB | ✅ Consistent treatment enforcement via monotonic constraints; no arbitrary non-linear reversals |
| **NCUA Regulations** | NCUA | ✅ Platform designed for credit union governance requirements; examination-ready artifacts |
| **OCC Large Institution Guidelines** | OCC | ✅ Audit package built to OCC examination format; exam_packet.json + PDF |
| **FRB SR letters** | Federal Reserve | ✅ SR 11-7 alignment; ongoing monitoring dashboard |

---

## 2. Model Risk Management (SR 11-7 Alignment)

SR 11-7 requires three core capabilities: (1) model development oversight, (2) independent model validation, and (3) ongoing monitoring. AgentHive operationalizes all three.

### 2.1 Model Development Oversight

| SR 11-7 Requirement | AgentHive Implementation |
|---|---|
| **Data lineage documentation** | `chain_of_custody.json` tracking every data source from ingestion to model artifact |
| **Feature rationale documentation** | Feature inclusion/exclusion log with proxy discrimination pre-screening results |
| **Training methodology** | Documented in Model Development Report (MDR) — auto-generated from training metadata |
| **Assumption register** | Structured assumption log maintained from Day 1; version-controlled |
| **Reject inference** | Reject inference simulation implemented and documented; critical for BIASED training data correction |
| **Monotonic constraints** | All monotonic constraints documented with direction and rationale per feature |

**Model Development Report (MDR) — Sections auto-generated:**
1. Executive Summary
2. Model Purpose and Scope
3. Data Sources and Limitations
4. Feature Engineering and Selection
5. Model Selection and Validation Results
6. Implementation and Controls
7. Ongoing Monitoring Plan
8. Known Limitations and Required Conditions for Use

### 2.2 Independent Model Validation

The platform does not conduct independent validation on behalf of customers (to avoid conflict of interest). Instead, it **enables** independent validation by providing:

- Complete model artifact package (`.pkl` files with SHA-256 hashes)
- Full training code and reproducibility instructions
- Holdout dataset definitions and outcome labels
- Backtesting results by cohort
- Challenger model comparison framework

**AgentHive generates the Model Validation Report (MVR) template** pre-populated with:
- Conceptual soundness review checklist
- Outcomes analysis results (AUC, KS, Gini, calibration)
- Benchmark comparison
- Monitoring plan with specific trigger thresholds
- Outstanding issues and required conditions

Customers provide this to their internal or external validator. Validation cycle time reduces from 18 months to < 4 months using AgentHive artifacts.

### 2.3 Ongoing Monitoring

Per SR 11-7, ongoing monitoring must track:
- Population Stability Index (PSI) — model input distributions
- Gini/AUC stability — model discriminatory power
- Approval rate stability
- Outcome analysis (when sufficient time has passed)
- Model usage (count, volume, segment)

**AgentHive monitoring dashboard provides:** All of the above, with:
- Daily refresh on PSI and approval rate
- Weekly refresh on AUC/Gini
- Automated alerts when thresholds breached (PSI > 0.20, AUC drop > 0.05)
- Pre-formatted monitoring reports for regulator submission

---

## 3. ECOA / Regulation B Compliance

### Adverse Action Requirement Compliance

Every DECLINE or CONDITIONAL decision must be accompanied by a Regulation B-compliant adverse action notice. AgentHive automates this completely:

```json
{
  "application_id": "APP-20260414-001",
  "decision": "DECLINE",
  "risk_score": 0.142,
  "decision_timestamp": "2026-04-14T14:22:31Z",
  "adverse_action_reasons": [
    {
      "rank": 1,
      "code": "AA-007",
      "description": "Insufficient cash flow stability over the prior 6 months",
      "regulation_b_text": "Insufficient cash flow from your account history"
    },
    {
      "rank": 2,
      "code": "AA-019",
      "description": "Monthly expense-to-income ratio exceeds acceptable threshold",
      "regulation_b_text": "Excessive obligations in relation to income"
    },
    {
      "rank": 3,
      "code": "AA-012",
      "description": "Limited payment consistency on recurring obligations",
      "regulation_b_text": "Delinquent past or present credit obligations with others"
    }
  ],
  "model_version": "lgbm_v1.0.0",
  "notice_template": "regulation_b_notice_v2.html"
}
```

All adverse action codes are pre-approved by Compliance before pilot launch and mapped to plain-language Regulation B notice templates.

### Disparate Impact (Fair Lending) Testing

AgentHive runs disparate impact tests both at model deployment and continuously during production:

| Test | Methodology | Trigger |
|---|---|---|
| Income quintile DI ratio | Approval rate Q1 / Approval rate Q5; must be ≥ 0.80 (4/5ths rule) | Quarterly + pre-deployment |
| Rate-spread disparity analysis | APR disparity across income groups with controls | On HMDA-reportable loans |
| Broker vs. retail channel | Approval rate and pricing parity by origination channel | Monthly |
| First-time homebuyer (FTHB) proxy | Approval rates for FTHB vs. established borrowers | Quarterly |
| Cramér's V proxy screen | All features tested for correlation with protected classes; > 0.10 flagged | Pre-deployment |

**Fair lending test suite generates:**  
`fair_lending_q1_vs_q5.json`, `fair_lending_fthb.json`, `fair_lending_broker_vs_retail.json`, `fair_lending_summary.json`

These are included verbatim in the OCC exam audit package.

---

## 4. Audit Readiness

### OCC Audit Package — What We Generate

When a customer runs `AgentHive: Build Audit Package`, the system produces a self-contained directory in under 5 minutes:

```
audit_package_<model_id>_<timestamp>/
├── README.txt                         – Human-readable index
├── exam_packet.json                   – Machine-readable ExamPacket (full detail)
├── exam_packet.pdf                    – ReportLab-rendered PDF (OCC exam format)
├── executive_summary.txt              – One-page compliance summary
├── data/
│   ├── terms_disparity_income_group.csv
│   ├── fair_lending_q1_vs_q5.json
│   ├── fair_lending_q2_vs_q5.json
│   ├── fair_lending_fthb.json
│   ├── fair_lending_broker_vs_retail.json
│   └── fair_lending_summary.json
├── methodology/
│   ├── fair_lending_methodology.txt
│   └── model_documentation_record.json  – SR 11-7 MDR
└── chain_of_custody.json               – Data provenance + run metadata
```

**Regulatory frameworks addressed in every package:**
- ECOA / Regulation B
- HMDA / FFIEC fair lending guidance
- CFPB UDAP/UDAAP examination procedures
- SR 11-7 Model Risk Management
- OCC large-institution examination procedures

### Pre-Exam Readiness Checklist

AgentHive maintains a live exam readiness score for each customer's model:

| Check | Passing Condition | Current Status |
|---|---|---|
| Model version registered | Every deployed version in registry | Auto-checked |
| MDR current | < 12 months since last update | Auto-checked |
| Validation complete | MVR exists and < 24 months old | Flagged if missing |
| PSI within limits | PSI < 0.20 (last 30 days) | Auto-checked daily |
| Fair lending ratio | DI ratio ≥ 0.80 (all groups) | Auto-checked daily |
| Adverse action codes current | All active codes reviewed by Compliance | Manual confirmation |
| Data lineage documented | chain_of_custody.json current | Auto-checked |
| Monitoring reports filed | Last 3 monthly reports available | Auto-checked |

---

## 5. Explainability & Fairness Architecture

### SHAP-Based Explainability

TreeSHAP computes exact Shapley values for every decision. This satisfies:
- **Regulatory explainability:** OCC, CFPB, and Fed all accept SHAP-based explanations as technically sound
- **ECOA adverse action:** Top-3 SHAP factors map to pre-approved reason codes
- **Loan officer transparency:** Plain-English copilot narrative wraps SHAP output for non-technical staff

### Fairness Constraints

| Technique | Implementation | Purpose |
|---|---|---|
| **Monotonic constraints** | Enforced in LightGBM `monotone_constraints` parameter | Prevent arbitrary feature reversals that could proxy discrimination |
| **Proxy discrimination screening** | Cramér's V test: all features vs. protected attributes | Features with V > 0.10 flagged for human review before deployment |
| **Reject inference simulation** | Implemented via iterated re-weighting on declined population | Corrects for approval bias in training data |
| **Calibration** | Platt scaling (logistic regression on raw LightGBM scores) | Ensures PD is a true probability (required for threshold-based decisioning) |
| **Demographic parity monitoring** | Daily 4/5ths rule check by income quintile | Continuous operational fairness control |

---

## 6. Data Governance

| Principle | Implementation |
|---|---|
| **Data minimization** | Only features required for scoring are stored in feature_snapshots; no raw transaction data retained beyond 90 days |
| **Retention policy** | Decision records: 7 years (ECOA); feature snapshots: 7 years; raw input data: 90 days |
| **Right to explanation** | Every applicant can request their decision explanation via the `/decisions/{id}/explain` endpoint |
| **Data subject deletion** | `/decisions/{id}/purge` endpoint soft-deletes PII; audit trail preserved; GDPR/CCPA compliant |
| **Cross-border restriction** | No applicant data crosses US borders (GCP us-central1 region enforcement) |
| **Data Use Agreements** | All customer data usage governed by DUA; no training on customer data without explicit consent |

---

## 7. How AgentHive Helps Clients Pass Audits

**Scenario: A $500M credit union faces its first NCUA examination after deploying an ML underwriting model.**

**Without AgentHive:**
- MRM team spends 8 weeks assembling documentation
- Fair lending tests run manually in Excel; results inconsistent
- Adverse action reason codes assigned by rules table, not SHAP
- Examiner finds: "incomplete documentation of model validation; no evidence of ongoing fair lending monitoring"
- Remediation required; potential confidential supervisory letter

**With AgentHive:**
- Pre-exam: CRO runs "Build Audit Package" → complete OCC-format package in 4 minutes
- Examiner receives: MDR, MVR, fair lending test suite, chain of custody, monitoring logs
- All adverse action records traceable to specific SHAP value at time of decision
- Examiner finding: "Model risk management program demonstrates robust documentation and ongoing monitoring; no material deficiencies identified"
- Result: Clean exam, zero findings, CRO cites AgentHive publicly in case study

This is the documented value proposition. We are building toward 2 case studies of this exact scenario by Q2 2027.
