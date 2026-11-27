# AgentHive — PMF Analysis & Rebranding Plan

**Date:** November 2026 · **Status:** Strategy draft for founder review
**Sources:** `docs/PRD.md`, `docs/startup_os/*`, live site copy (`src/lib/use-cases.ts`, `src/app/layout.tsx`), competitor sites (zest.ai, scienaptic.ai) verified Nov 2026.

---

## Part 1 — Product-Market Fit Analysis (Customer Perspective)

*Persona used: Chief Risk Officer at a ~$2B AUM fintech lender — the stated ICP.*

### 1.1 What resonates

1. **The governance wedge is real.** MRM teams genuinely spend hundreds of hours assembling SR 11-7 validation documentation. Every incumbent (Zest, Scienaptic) treats compliance as a marketing slide, not a deliverable. "Audit package in 5 minutes, not 6 weeks" is the strongest sentence in our materials.
2. **"You own the model" is a sharp counter-position.** Post-Upstart CFPB scrutiny, CROs are wary of black-box model-as-a-service. AgentHive as *transparency infrastructure* rather than *model provider* is defensible and differentiated.
3. **Thin-file specialization is a real pain.** 45M credit-invisible Americans; bureau scores genuinely fail there. AUC 0.72–0.78 on thin-file is credible and specific.

### 1.2 Where buyers hesitate

| # | Objection | Deal impact |
|---|---|---|
| 1 | **Identity confusion.** The PRD describes an "interactive portfolio + demo platform to convert visitors into consulting clients." The startup_os describes a "credit intelligence operating system." Those are two different companies. | Confused buyers don't buy. Procurement needs a category. |
| 2 | **No proof artifacts.** We claim "audit package in under 5 minutes" and "validation cycle 18mo → 4mo" but show no redacted sample Model Validation Report and no named case study. Scienaptic shows 160+ lenders, $160B decisioned, named CU logos, "100% NCUA audit pass." | In regulated lending, proof > product. |
| 3 | **Integration Gateway (Layer 3) dilutes the wedge.** "Register any FastAPI service as a product card" targets AI builders — a different buyer than a CRO. Reads as scope creep and invites "so you're a demo-hosting platform?" misreading. | Two ICPs = one confused GTM. |
| 4 | **No LOS/core integration story.** Scienaptic leads with MeridianLink, Origence, Temenos, Symitar, Fiserv, Corelation and 6–10 week deployment. Our docs mention none. For a lender, LOS integration *is* the product. | Without it, deployment cost dwarfs license cost. |
| 5 | **No pricing signal.** Zest is $150K–$500K ACV. Buyers need to know if we're a $30K tool or a $300K platform before spending political capital. | No pricing = no internal champion. |
| 6 | **Regulatory claims need a compliance moat.** First diligence question: "Which lender has actually passed an exam using your artifacts?" Until non-zero, it's aspiration. | One clean exam > the entire feature list. |

### 1.3 PMF verdict by segment

| Segment | Fit today | Assessment |
|---|---|---|
| Mid-market lender CRO (stated ICP) | **Weak-to-moderate** | Right problem, right wedge, zero proof points vs. entrenched vendors |
| Credit unions | **Weak** | Scienaptic and Zest own this channel with LOS integrations and NCUA-specific messaging |
| External AI builders (Integration Gateway) | **Unproven** | Real itch, but they'd use Vercel + a demo page, not a credit-governance-branded platform |
| **Consulting-led wedge** (demo lab → paid pilot → product) | **Strongest near-term path** | The PRD's actual model is the most honest PMF route available |

**Bottom line:** Problem fit 9/10. Product fit 4/10 — the public surface is a demo lab while the pitch is a compliance operating system. The PMF unlock is a single artifact: **one real lender passing one real exam with an AgentHive-generated audit package.**

### 1.4 Competitive landscape (verified Nov 2026)

#### Direct — AI credit decisioning

| Competitor | Offering | Traction | Our counter |
|---|---|---|---|
| **Zest AI** | AI underwriting + fraud + **LuLu** conversational lending intelligence. Custom models delivered inside the LOS | ~$225M raised; 1 in 7 US adults supported; Citi, Truist, Suncoast, Golden 1 | They own the model; we give lenders governance ownership. Note: LuLu competes with our Copilot |
| **Scienaptic AI** | Full decision string (pre-qual → KYC → fraud → underwriting → pricing → early warning) + **iCUE agentic layer** + "exam-ready by design" compliance engine | 160+ lenders, $160B+ decisioned, 500M training records, "100% NCUA audit pass," deep LOS integrations | **Most dangerous competitor.** Already colonized "compliance + decisioning" in CUs. Our edge: bank/fintech SR 11-7 depth + customer-owned models |
| **Upstart** | Model-as-a-service marketplace | $514M rev (2023), public | CFPB disparate-impact history is our opening; they have the best thin-file data in the industry |
| **Stratyfy** | Transparent "glass box" ML underwriting + bias testing | Smaller; closest philosophical match on explainability | They win on interpretability purity; we win on audit-package automation |
| **Pagaya** | AI credit network (B2B2C) | Public, large-scale | Different model, same "approve more thin-file" budget |

#### Governance / fairness layer (closest to Audit Fabric)

| Competitor | Offering | Notes |
|---|---|---|
| **FairPlay** | Fairness-as-a-service: bias testing, fair-lending analytics | Closest pure-play to Layer 2. Validates the category; they do fairness testing, not full audit-package generation |
| **Moody's / Big 4 MRM practices** | SR 11-7 validation engagements, $200K–$2M | Partner-or-displace framing is correct |
| **FICO / Experian Ascend / TransUnion** | Bureau scores + decisioning suites | Slow but own distribution. Position as complementary for thin-file |

#### Decisioning infrastructure (adjacent threats)

| Competitor | Offering | Threat |
|---|---|---|
| **Taktile** | Generic decision platform for fintechs | **High** — well-funded, horizontal, could add governance modules |
| **Provenir** | Enterprise decisioning + data orchestration | Medium — entrenched |
| **Oscilar** | AI risk decisioning (fraud + credit) | Medium |
| **Casca / Salient** | Agentic-AI lending automation | Watch — agentic lending is where iCUE is already going |

### 1.5 Strategic takeaways

1. **Category validated, crowded at the decisioning layer.** We will not out-decision Zest/Scienaptic's 5–15 year head starts.
2. **The uncontested space is governance automation as the product** — machine-generated SR 11-7 artifacts, continuous disparate-impact monitoring, exam-readiness scoring. Only FairPlay plays nearby, and only on fairness testing.
3. **Window is ~12–24 months** before incumbents rebrand compliance slides as governance products (Scienaptic's "exam-ready by design" shows it's already starting).
4. **Strategic recommendation:** de-emphasize the Integration Gateway as a market-facing pillar (keep as internal plumbing), pick ONE ICP (mid-market fintech lenders, not CUs), and spend everything on one proof artifact.

---

## Part 2 — Rebranding Plan

### 2.1 The core repositioning

| Dimension | From (current) | To (target) |
|---|---|---|
| Category | "AI Credit Decisioning Platform" / demo lab | **Governance-native credit infrastructure** / "the compliance layer for AI lending" |
| Primary buyer | Ambiguous (visitor → consulting lead) | Head of Model Risk / CRO at mid-market fintech lenders ($100M–$5B AUM) |
| Core promise | "Try our AI products live" | **"Pass your next model-risk exam in weeks, not years"** |
| Proof style | Interactive demos | Exam artifacts, audit packages, named pilot outcomes |
| Layer ordering | Lab first, governance buried | **Audit Fabric first** (the wedge), RuleSense second (the engine), Lab third (the demo *of* the governance, not the product) |
| Integration Gateway | Market-facing pillar | Internal capability; never on the homepage |

### 2.2 Naming & verbal identity

1. **Resolve the AgentHive vs AgentHiveHQ split.** The domain is `agenthivehq.com`, the product is "AgentHive," the legal docs say "AgentHiveHQ." Pick one. Recommendation: **product = AgentHive**, company/domain can stay agenthivehq.com short-term, but all product surfaces say "AgentHive." Budget a domain acquisition for `agenthive.ai` (already referenced in `src/lib/api.ts` error URLs — currently inconsistent).
2. **Product names:** keep **RuleSense** (engine) and **Audit Fabric** (layer 2) — but elevate Audit Fabric to the lead brand. Consider renaming the Lab → **"AgentHive Exam Room"** or **"Live Governance Demo"** so the demo is framed as *proof of governance*, not a product playground.
3. **Tagline candidates** (test with 5 friendly CROs):
   - "Audit-ready AI lending."
   - "The governance layer for AI credit decisioning."
   - "Every decision. Explained, logged, exam-ready."
4. **Kill consulting-portfolio language** everywhere in prospect-facing surfaces ("portfolio," "case study pages that convert visitors," "book a demo to hire us"). The site must read as a product company, not a services brochure.

### 2.3 Messaging hierarchy (new homepage structure)

1. **Hero:** outcome claim — "Pass SR 11-7 exams with machine-generated audit packages. Approve thin-file borrowers with models you own and can defend."
2. **Proof bar:** the exam artifact (sample MVR download, redacted), pilot metrics, "audit package in < 5 minutes" with a live counter/demo.
3. **The wedge product:** Audit Fabric — decision logs, model registry, disparate-impact monitoring, one-click exam export.
4. **The engine:** RuleSense — thin-file underwriting, SHAP adverse-action reasons, monotonic constraints.
5. **The demo:** reframed as "See a decision the way your examiner will" — every demo output shows the audit trail, not just the decision.
6. **Integrations:** LOS/core section (even if initially "MeridianLink-ready, Symitar on roadmap") — this is table stakes credibility.
7. **Pricing signal:** at minimum "Pilot from $Xk / Platform from $Yk ACV" or "Talk to us — typical ACV $75–150K." Silence is worse than a range.
8. **CTA:** from "Book Demo" → **"Get a sample audit package"** (artifact-led CTA; the artifact sells the meeting).

### 2.4 Concrete execution steps (sequenced)

**Phase 0 — Decisions (week 1)**
- [ ] Founder sign-off: one ICP (mid-market fintech lenders), one wedge (Audit Fabric), one proof goal (one real exam).
- [ ] Decide naming resolution (AgentHive vs AgentHiveHQ) and domain strategy.
- [ ] Decide Integration Gateway visibility: internal-only (recommended) or partner-beta.

**Phase 1 — Proof artifacts (weeks 1–4, highest leverage)**
- [ ] Generate a **sample Model Validation Report** from the actual RuleSense model; redact; publish as gated download.
- [ ] Publish a **sample one-click exam package** (the `Build Audit Package` output) as a live artifact prospects can inspect.
- [ ] Recruit 1–2 design-partner lenders (the consulting network is the pipeline — use it) with an explicit "we get you exam-ready, you let us say so" agreement.
- [ ] Add an **exam-readiness score** widget to the governance dashboard and screenshot it for the homepage.

**Phase 2 — Site & copy rebrand (weeks 3–6)**
- [ ] Rewrite `src/app/layout.tsx` metadata: title from "AgentHiveHQ | AI Credit Decisioning Platform" → "AgentHive | Audit-Ready AI Credit Decisioning."
- [ ] Reorder homepage sections per §2.3; move the Lab behind "See it the way your examiner will."
- [ ] Update `src/lib/use-cases.ts`: lead with the `governance-exam` use case (currently last); reframe the three borrower personas as "decisions your examiner will accept," not just approvals.
- [ ] Remove/de-emphasize Integration Gateway marketing pages; keep `INTEGRATION_MANUAL.md` as partner docs behind auth.
- [ ] Add /pricing or pricing-range section; add /integrations (LOS) page even if roadmap-labeled.
- [ ] Fix the `agenthive.ai` vs `agenthivehq.com` inconsistency in `src/lib/api.ts` error URLs.

**Phase 3 — Docs & GTM alignment (weeks 4–8)**
- [ ] Rewrite `docs/PRD.md` §1–3: product type from "Interactive AI Portfolio + Demo Platform" → "Governance-native credit decisioning platform"; drop "converts visitors into consulting clients" as a product objective (move to internal GTM notes).
- [ ] Update `docs/startup_os/07_competitive_landscape.md` with the verified Nov 2026 data in §1.4 (Scienaptic iCUE, Zest LuLu, FairPlay, Taktile are currently missing or stale).
- [ ] Sales deck: lead with the exam artifact, not the demo. One slide = one redacted MVR page.
- [ ] Outbound motion: target Heads of Model Risk (not just CROs) at fintech lenders post-Series B — they feel SR 11-7 pain first and champion tools.

**Phase 4 — Proof & iteration (quarter)**
- [ ] Land first pilot → drive one real exam/audit with AgentHive artifacts → publish anonymized case study with the examiner outcome.
- [ ] Instrument conversion: sample-MVR downloads → meetings → pilots. The artifact CTA should beat "book demo" 2–3x; if not, the wedge messaging is wrong.
- [ ] Revisit Integration Gateway as a public pillar only after 3+ paying governance customers.

### 2.5 What NOT to change

- **Thin-file specialization** — keep it; it's the credible technical moat and the reason the governance story isn't generic.
- **"You own the model" positioning** — sharpen it, don't drop it.
- **The demo lab itself** — it's a genuine asset; the fix is framing (proof of governance), not removal.
- **Regulatory stack coverage (SR 11-7, ECOA/Reg B, FCRA, UDAAP, HMDA)** — correct and differentiated; just needs proof attached.

### 2.6 Success metrics for the rebrand

| Metric | Current (est.) | 90-day target |
|---|---|---|
| Homepage primary CTA | "Book demo" | "Get sample audit package" live, >2x CTR of old CTA |
| Proof artifacts public | 0 | 2 (sample MVR + sample exam package) |
| Named/design-partner pilots | 0 | 1–2 signed |
| ICP clarity test (5 buyers read homepage, state what we sell) | Fails | 5/5 say "governance/compliance for AI lending" |
| Pricing signal on site | None | Range published |
