# AgentHive — Competitive Landscape

**Version:** 1.0 | **Date:** April 2026  
**Owner:** CEO / Product | **Audience:** Investors, Board, Sales

---

## 1. Market Map

The credit risk technology market has four distinct categories. AgentHive operates at the intersection of all four — which is why no single incumbent threatens it directly, but also why the market education challenge is real.

```
                        ┌─────────────────────────────────────────┐
                        │    HIGH GOVERNANCE / COMPLIANCE FOCUS    │
                        └───────────────┬─────────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────────┐
              │                         │                              │
     Advisory firms              AgentHive ◄── TARGET               Moody's MRM
     (Deloitte MRM)               POSITION                          (regulatory)
              │
NARROW ───────┼───────────────────────────────────────────── BROAD
(Alt data     │                                              (All credit
  only)       │                                               segments)
              │
            Zest AI                                      Experian
            Upstart ◗                                    FICO ◗
            Nova Credit ◗                                TransUnion
              │
              │
              └─────────────────────────┬──────────────────────────────┘
                                        │
                        ┌───────────────┴─────────────────────┐
                        │  LOW GOVERNANCE / COMPLIANCE FOCUS   │
                        └─────────────────────────────────────┘
```

---

## 2. Direct Competitors

### 2.1 Zest AI

| Attribute | Detail |
|---|---|
| **What they do** | AI-powered underwriting model builder for credit unions and community banks |
| **Founded** | 2009 (formerly ZestFinance) |
| **Funding** | ~$225M raised |
| **Revenue** | ~$40M ARR (est.) |
| **Target segment** | Credit unions, community banks |
| **Pricing** | Enterprise-only; $150K–$500K ACV |
| **Strengths** | Strong CU relationships; regulatory track record; explainability features |
| **Weaknesses** | Requires handing over model-building to Zest; not white-label; expensive; limited governance automation for customer's own MRM process; no thin-file specialization |
| **How AgentHive wins** | AgentHive customers OWN their models; our governance layer serves their regulators, not ours. Zest is a black box for the customer's MRM team. We are transparency infrastructure. |

### 2.2 Upstart

| Attribute | Detail |
|---|---|
| **What they do** | AI lending marketplace + model-as-a-service for bank/CU partners |
| **Founded** | 2012 |
| **Revenue** | $514M (2023); down from peak |
| **Model** | Platform provides the model; banks originate |
| **Strengths** | Strong thin-file performance data; established bank partnerships; regulatory track record |
| **Weaknesses** | Banks bear credit risk but lack governance ownership; model is Upstart's black box; customer has no MRM control; highly cyclical revenue; under CFPB scrutiny for disparate impact (2023) |
| **How AgentHive wins** | We give lenders governance control. After Upstart's CFPB disparate impact issue, CROs are wary of "we run the model for you" arrangements. AgentHive is "you govern your model, we remove the friction." |

### 2.3 Nova Credit

| Attribute | Detail |
|---|---|
| **What they do** | Cross-border credit passport; alternative data for international/thin-file applicants |
| **Founded** | 2016 |
| **Funding** | $220M raised |
| **Target** | Immigrants; international students; global workers |
| **Strengths** | Unique cross-border credit data; partnerships with Experian; American Express partnership |
| **Weaknesses** | Data layer only — no decision engine, no governance tooling; narrow use case (immigrants specifically) |
| **How AgentHive wins** | Nova Credit is a data source. AgentHive is a governed decisioning platform. We could potentially integrate Nova Credit as a data feed via our integration gateway. Not a direct competitor. |

### 2.4 Scienaptic AI

| Attribute | Detail |
|---|---|
| **What they do** | AI credit underwriting platform for credit unions |
| **Founded** | 2010 |
| **Target** | Credit unions primarily |
| **Strengths** | Established CU relationships; explainability layer |
| **Weaknesses** | Limited governance automation; no audit package generation; limited monitoring; expensive implementation |
| **How AgentHive wins** | Governance automation depth; thin-file specialization; faster time-to-compliance |

---

## 3. Indirect Competitors

### 3.1 Manual Processes + Internal Teams

| Attribute | Detail |
|---|---|
| **What they are** | Excel-based scorecards; SQL-based rule engines; internal MRM teams assembling Word/PDF documentation |
| **Why they fail** | 6–8 weeks per audit package; inconsistent; error-prone; no PS1 monitoring; non-scalable |
| **Why customers stay with them** | Control, familiarity, no procurement cycle required |
| **How AgentHive displaces** | Show the time cost: "Your MRM team spends 800 hours/year on documentation. We reduce that to 40." |

### 3.2 Legacy Credit Bureau Solutions (Experian, Equifax, TransUnion)

| Attribute | Detail |
|---|---|
| **What they do** | Traditional credit scores (FICO, VantageScore); bureau-based attributes; some ML model-building services |
| **Strengths** | Universal adoption; regulatory acceptance; deep lender relationships |
| **Weaknesses** | Miss 45M thin-file consumers; no real-time explainability; zero MRM/governance tooling; slow to innovate; conflict of interest (they sell data AND decisioning) |
| **How AgentHive positions against them** | We are not replacing the bureau for bureau-eligible applicants. We extend credit to the 45M they can't score. We govern the models bureaus can't govern. Complementary, not competitive. |

### 3.3 Consulting Firms (Deloitte, KPMG, Accenture MRM Practice)

| Attribute | Detail |
|---|---|
| **What they do** | SR 11-7 model validation; MRM framework setup; audit prep engagements |
| **Pricing** | $200K–$2M per engagement |
| **Why they fail** | People-heavy, not scalable; deliver PDFs not systems; expensive; knowledge walks out the door |
| **How AgentHive positions** | "We sell the system that makes your MRM team (or your consulting engagement) 10x faster." Partner opportunity: Big 4 can use AgentHive in their practice. |

### 3.4 nCino / Blend / ICE Mortgage (Loan Origination Systems)

| Attribute | Detail |
|---|---|
| **What they do** | Workflow automation for loan origination; document management; compliance workflows |
| **Why they don't compete** | They are not AI decisioning or model governance platforms. They send applications to models — they don't build or govern them. |
| **Partnership opportunity** | AgentHive governance layer embedded in nCino/Blend as an add-on. |

---

## 4. Comprehensive Feature Comparison Table

| Feature | AgentHive | Zest AI | Upstart | Experian | Scienaptic | Manual |
|---|---|---|---|---|---|---|
| **Alternative data underwriting** | ✅ Native | ✅ Limited | ✅ Strong | ❌ Bureau only | ✅ Limited | ❌ |
| **Customer owns the model** | ✅ Yes | ❌ Zest owns it | ❌ Upstart owns it | ✅ Yes | ✅ Yes | ✅ Yes |
| **Real-time SHAP explanations** | ✅ Native | ✅ Yes | ❌ Limited | ❌ | ✅ Limited | ❌ |
| **ECOA adverse action codes** | ✅ Automated | ✅ Semi-auto | ❌ Manual | ❌ Manual | ✅ Limited | ❌ Manual |
| **SR 11-7 MDR auto-generation** | ✅ Native | ❌ Manual | ❌ | ❌ | ❌ | ❌ |
| **OCC audit package (automated)** | ✅ Native | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Continuous fair lending testing** | ✅ Daily | ✅ Periodic | ❌ | ❌ | ❌ | ❌ |
| **PSI/AUC monitoring** | ✅ Daily | ✅ Limited | ❌ | ❌ | ✅ Limited | ❌ |
| **External AI integration gateway** | ✅ Unique | ❌ | ❌ | ❌ | ❌ | ❌ |
| **White-label / API-first** | ✅ Yes | ❌ | ❌ | ❌ | ❌ | N/A |
| **Thin-file specialized** | ✅ Core focus | ✅ General | ✅ Good | ❌ | ✅ General | ❌ |
| **Pricing transparency** | ✅ Published | ❌ Enterprise-only | ❌ Enterprise-only | ❌ | ❌ | N/A |

---

## 5. Our Differentiation — Three Unfair Advantages

### Advantage 1: Governance-Native Architecture
Every competitor treats governance as a feature added on top of decisioning. In AgentHive, the immutable audit log, model version pinning, SHAP computation, and ECOA reason code generation are **part of the scoring pipeline** — not optional modules. You cannot use the decision engine without generating governance artifacts. This is architecturally defensible.

### Advantage 2: Regulatory Alignment (SR 11-7 + ECOA + HMDA)
AgentHive is the first platform to ship **production-ready SR 11-7 artifacts** (MDR, MVR, Model Card) and **HMDA-format audit packages** as a core product feature. This required deep OCC/CFPB domain expertise — not just ML engineering. The combination of fintech ML + regulatory domain knowledge is the actual moat.

### Advantage 3: Data Compound Advantage
Every decision made on the platform (with customer consent) contributes to a growing proprietary dataset of thin-file credit outcomes. Over time, this gives AgentHive a training data advantage no new entrant can replicate in < 3 years. Combined with reject inference capabilities, our model improves continuously while competitors start from zero with each new customer.
