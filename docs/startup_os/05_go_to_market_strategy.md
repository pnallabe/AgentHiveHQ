# AgentHive — Go-To-Market Strategy

**Version:** 1.0 | **Date:** April 2026  
**Owner:** CEO / VP Sales | **Audience:** Internal, Investors, Board

---

## 1. ICP Definition (Ideal Customer Profile)

### Primary ICP: Mid-Market Fintech Lenders

| Attribute | Profile |
|---|---|
| **Revenue** | $10M–$200M ARR |
| **AUM / Loan Book** | $50M–$2B |
| **Geography** | United States (primary); Canada (secondary) |
| **Regulatory exposure** | Subject to OCC, NCUA, CFPB examination; state lending licenses |
| **AI maturity** | Deployed 1–3 ML models in production; no dedicated MRM team |
| **Pain trigger** | Recent OCC/NCUA exam finding on model governance; board pressure on responsible AI |
| **Decision maker** | Chief Risk Officer (CRO) or Chief Compliance Officer (CCO) |
| **Champion** | Head of Credit / Senior Risk Analyst |
| **Budget authority** | $50K–$300K annual discretionary for technology |

### Secondary ICP: Credit Unions + CDFIs

| Attribute | Profile |
|---|---|
| **Revenue** | $5M–$100M |
| **AUM** | $100M–$3B |
| **Geography** | US (all 50 states) |
| **Regulatory exposure** | NCUA; state DFIs; CDFI Fund compliance |
| **AI maturity** | Early-stage (evaluating first ML model); OR legacy scorecard wanting to upgrade |
| **Pain trigger** | CFPB fair lending scrutiny; desire to serve underbanked members; thin-file loan demand |
| **Decision maker** | VP of Lending / Chief Lending Officer |
| **Budget** | $25K–$150K/yr |

### Tertiary ICP (Future, Year 2+): Community Banks and Mortgage Servicers

- Subject to OCC/Fed/FDIC examination
- Freddie Mac / Fannie Mae seller/servicer with HMDA reporting obligations
- Motivated by automated HMDA audit packaging capability

---

## 2. Segmentation

| Segment | Size | Entry Difficulty | ACV | Priority |
|---|---|---|---|---|
| Fintech lenders (BNPL, personal loan, neobanks) | ~1,400 active | Medium — fast-moving, technical | $85K | P1 |
| Credit unions ($100M–$5B AUM) | ~2,200 | Medium — procurement-heavy but mission-aligned | $60K | P1 |
| CDFIs | ~1,400 | Low — CDFI mandate creates pull | $40K | P2 |
| Community Banks (<$10B) | ~4,500 | High — slower procurement, OCC relationship-dependent | $120K | P2 |
| Mortgage servicers | ~500 | High — specialized (HMDA focus) | $150K | P3 |

---

## 3. Entry Wedge Strategy

**Lead with the governance pain, not the AI feature.**

Most credit platforms lead with "better AI = better approvals." AgentHive leads with:

> *"Your next OCC exam will flag model governance. We eliminate that risk. In the process, you also get better AI for thin-file applicants."*

**Why this works:**
- Governance pain is universal, immediate, and regulated (not optional)
- Approval rate improvement is a proof point, not the buying trigger
- CROs have budget authority over compliance tools; champions (risk analysts) advocate for the AI layer

**The wedge product:** Governance-as-a-Service (audit package builder). Sell this first at $15K–$50K. No integration required initially — works with any existing model. Once customer relies on our audit artifacts, upsell the full decision engine.

---

## 4. Sales Motion

### Phase 1 Months 0–12: High-Touch Enterprise Sales (Beachhead)

- **Who sells:** Founders (CEO-led sales for first 6 customers)
- **Motion:** Relationship-driven, consultative; 60–90 day cycles
- **Entry channel:** CUNA (Credit Union National Association) network events; Filene Institute CU innovation circles; CDFI Coalition
- **Pilot offer:** 90-day free pilot → convert to paid at end of pilot; requires signed LOI within 30 days of pilot start
- **Proof strategy:** First customer must agree to co-author a case study after passing regulatory exam

### Phase 2 Months 12–24: Hybrid Sales (Hire VP Sales + PLG for Fintechs)

- **Enterprise track:** VP Sales handles credit unions + community banks (relationship motion)
- **PLG track:** Self-serve Starter tier for fintechs; frictionless API key signup; 14-day free trial
- **Content-led ABM:** "OCC Model Governance Exam Prep" content targeting CRO/MRM audience via LinkedIn + direct email
- **Channel: Plaid Partner Network** — co-sell with Plaid for bank data enrichment; Plaid refers fintechs that need compliant underwriting

### Phase 3 Months 24–36: Enterprise Expansion + Channels

- **White-label:** Approach Blend, nCino, and ICE Mortgage for embedded AgentHive governance layer
- **Advisory firm channel:** Big 4 (KPMG, Deloitte) use AgentHive in their MRM advisory practice — deliver faster, charge same rates
- **Agency banking:** Embedded finance platforms (Unit, Treasury Prime) bundle AgentHive as compliance layer

---

## 5. Pricing Model

### SaaS Tiers

| Tier | Inclusions | Monthly Price | Annual (20% discount) |
|---|---|---|---|
| **Starter** | 1,000 decisions/mo; RuleSense API; basic SHAP; 90-day audit log | $3,500/mo | $33,600/yr |
| **Growth** | 10,000 decisions/mo; full Audit Fabric; 3 model slots; governance dashboard; PSI/AUC monitoring | $8,500/mo | $81,600/yr |
| **Enterprise** | Unlimited decisions; full platform; custom integrations; dedicated CSM; SLA 99.9% | $22,000/mo+ | $240,000+/yr |

### Add-Ons (Usage or Event-Based)

| Add-On | Price |
|---|---|
| OCC/HMDA Audit Package (per model, per event) | $15,000–$50,000 |
| Additional model slots (per model/mo) | $1,500/model/mo |
| Integration Gateway product registration | $1,000/product/mo |
| LLM Copilot narrative layer | $500/mo (included in Enterprise) |
| SR 11-7 validation support (services) | From $25,000 |

### Pricing Philosophy
- **Land with audit package** (high-urgency, low-commitment)
- **Expand with decision engine** (embed into core operations)
- **Retain with monitoring + exam readiness** (switching cost increases over time)

---

## 6. Distribution Channels

| Channel | Mechanism | Expected % of Pipeline |
|---|---|---|
| **Direct outbound** | Founder-led, then VP Sales; targeted account list (200 ICPs) | 50% Y1; 30% Y3 |
| **Inbound (content)** | "MRM exam prep" content; webinars with ex-OCC examiners | 15% Y1; 25% Y3 |
| **CUNA / CDFI networks** | Speaking slots; event sponsorships; member introductions | 20% Y1; 15% Y3 |
| **Technology partnerships** | Plaid, Alloy co-sell; inbound referrals | 10% Y1; 15% Y3 |
| **Channel / Advisory firms** | Big 4 embed in MRM practice | 5% Y1; 15% Y3 |

---

## 7. Partnerships Strategy

| Partner | Type | Value Exchange | Timeline |
|---|---|---|---|
| **Plaid** | Technology | Bank data feeds into AgentHive feature pipeline; Plaid refers fintechs needing compliant underwriting | Q3 2026 |
| **Alloy** | Technology | Identity verification layer for applicant enrichment | Q4 2026 |
| **CUNA Mutual** | Distribution | Co-market to CUNA member credit unions; potential white-label | Q2 2026 |
| **CDFI Fund** | Regulatory/Mission | Mission alignment for underserved lending; potential grant funding | Q3 2026 |
| **Deloitte / KPMG** | Channel | MRM advisory firms use AgentHive in exam prep engagements | Q1 2027 |
| **nCino / Blend** | OEM/Embed | Governance layer embedded in their LOS platforms | Q2 2027 |
| **OpenAI / Anthropic** | Technology | LLM copilot layer; co-marketing in regulated finance segment | Q4 2026 |

---

## 8. Pilot / Lighthouse Customer Strategy

**Objective:** Secure 2 marquee customers who will (a) pass a regulatory exam using AgentHive artifacts and (b) publicly co-author a case study.

### Ideal Lighthouse Profile
- **Credit union** in top NCUA asset tier ($500M–$2B AUM) — recently exam-flagged
- **Fintech lender** with Series B+ funding — CFPB-reporting threshold crossed

### Pilot Structure
- **Duration:** 90 days
- **Pricing:** Free platform access; $0 on decisions
- **Commitment required:** Signed NDA + reference letter + case study rights post-exam
- **Milestones:** 
  - Week 2: Integration complete, first live decision
  - Week 6: Governance dashboard live; first PSI report
  - Week 10: OCC/NCUA-format audit package assembled and reviewed by customer's compliance team
  - Week 13: Go/no-go for paid conversion

### Case Study Design
Evidence collected:
1. Pre-AgentHive exam finding (MRM deficiency) — anonymized
2. Post-AgentHive: audit package review by their compliance team
3. Exam result: zero model governance findings
4. Approval rate lift for thin-file segment (if using decision engine)
5. Staff time saved on audit package preparation (hrs → mins)

---

## 9. Sales Funnel Metrics (Targets)

| Stage | Month 12 Target | Month 24 Target |
|---|---|---|
| Target accounts in sequence | 200 | 500 |
| Discovery calls completed | 60 | 180 |
| Pilots started | 12 | 40 |
| Deals closed | 6 | 20 |
| Closed ARR | $480K | $1.8M |
| Win rate (pilot → closed) | 50% | 55% |
| Average sales cycle | 75 days | 60 days |
| Payback period | 14 months | 11 months |
