# AgentHive – AI Credit Decisioning Platform
## Sprint Plan (Production-Grade Agile)

---

> **Engineering Persona**: Senior full-stack engineer + AI platform architect. Code reviewed by a Chief Risk Officer, Head of Platform Engineering, and Compliance Officer before production.
>
> **Standard**: Every story, every task, every acceptance criterion reflects what a real fintech company ships. Build it as if a $10M lending book depends on it.
>
> **Sprint Cadence**: 3–4 days per sprint (compressed release cycle). Each sprint ends with a shippable, demable increment.
>
> **Story Point Scale**: 1 = 1–2 hrs · 2 = half day · 3 = full day · 5 = 1–2 days · 8 = 2–3 days

---

## 🗂️ BACKLOG OVERVIEW

| Sprint | Theme | Days | Points |
|---|---|---|---|
| Sprint 1 | Backend Scaffold + Rules Engine | Days 1–3 | 28 |
| Sprint 2 | Typed API Client + Basic Lab UI | Days 4–5 | 22 |
| Sprint 3 | ML Intelligence + SHAP + Copilot | Days 6–9 | 34 |
| Sprint 4 | Governance APIs + Genkit LLM Flow | Days 10–12 | 30 |
| Sprint 5 | Backend Hardening + Tests + Docker | Days 13–14 | 20 |
| Sprint 6 | Design System + Navbar + Homepage | Days 15–18 | 36 |
| Sprint 7 | Lab UI Rebuild + Governance UI | Days 19–22 | 38 |
| Sprint 8 | Auth UI + Case Studies + Polish + A11y | Days 23–25 | 28 |
| **Total** | | **25 days** | **236** |

---

## GLOBAL DEFINITION OF DONE

A story is **done** when ALL of the following are true:

**Backend stories:**
- [ ] Pydantic validation returns `422` on bad input (tested)
- [ ] Pytest test passes (happy path + at least one error path)
- [ ] DB write confirmed via `GET /api/underwriting/history`
- [ ] Response matches the API contract in `CODING_PROMPT.md §4.5`
- [ ] Errors follow RFC 7807 Problem Details format
- [ ] No Python type errors (`mypy app/` clean)

**Frontend stories:**
- [ ] Renders without console errors
- [ ] Loading state visible during API call (skeleton, not spinner)
- [ ] Error state shown in-UI (not just console)
- [ ] Responsive at 375px + 1280px
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] `decision_id` visible and copyable where applicable

**UI/UX stories (Sprint 6–8 only):**
- [ ] Background is `bg-surface-base` (zinc-950) in dark mode
- [ ] All numbers use `font-mono tabular-nums`
- [ ] All cards have `border border-surface-border`
- [ ] Animations respect `prefers-reduced-motion`
- [ ] All interactive elements have visible focus rings

---

---

# SPRINT 1 — Backend Scaffold + Rules Engine
**Theme**: Foundation. Standing up the FastAPI service, database, and deterministic rules — no ML yet.
**Duration**: Days 1–3 · **Capacity**: 28 points
**Sprint Goal**: A running FastAPI service that accepts an underwriting request and returns a rules-based decision, persisted to SQLite, with a full audit trail.

---

### Story 1.1 — Backend Project Scaffold
**As a** developer, **I want** a properly structured FastAPI project **so that** all subsequent backend work has a clean home.
**Points**: 2

**Tasks:**
- Create `/backend/` with: `main.py`, `requirements.txt`, `Dockerfile`, `docker-compose.yml`, `.env.example`
- Implement `app/core/config.py` using Pydantic `BaseSettings` — reads `APP_ENV`, `DATABASE_URL`, `APP_PORT`, `APP_LOG_LEVEL`, `ALLOWED_ORIGINS`
- Implement `app/core/logging.py` — structured JSON logging, log level from env
- Implement `app/main.py` — FastAPI app factory with CORS middleware (`ALLOWED_ORIGINS` from config)
- Register `GET /api/health` → `{ "status": "ok", "env": "<APP_ENV>", "timestamp": "<ISO8601>" }`

**Acceptance Criteria:**
- [ ] `uvicorn app.main:app --reload --port 8000` starts without errors
- [ ] `GET /api/health` returns 200 with correct JSON
- [ ] CORS rejects requests from unlisted origins
- [ ] All config values loaded from `.env`, not hardcoded

---

### Story 1.2 — Database Setup + ORM Models
**As a** developer, **I want** async SQLAlchemy with SQLite (local) / PostgreSQL (prod) **so that** decisions and audit logs are persisted with UUID primary keys.
**Points**: 5

**Tasks:**
- Implement `app/database.py` — async engine (`create_async_engine`), session factory, `get_db` dependency
- Implement `app/shared/db_models.py`:
  - `DecisionRecord` table: `id (UUID PK)`, `created_at (UTC)`, `applicant_ref`, `input_payload (JSON)`, `decision`, `credit_limit (Numeric 12,2)`, `apr (Numeric 5,2)`, `confidence_score (Numeric 5,4)`, `risk_segment`, `reason_codes (JSON)`, `shap_values (JSON)`, `model_version`, `rules_triggered (JSON)`, `demo_mode (bool)`
  - `AuditLog` table: `id (UUID PK)`, `created_at (UTC)`, `decision_id (FK → decisions.id CASCADE DELETE)`, `event_type`, `actor`, `metadata (JSON)`
- Configure Alembic: `alembic init alembic`, `alembic.ini`, initial migration `0001_initial_schema.py`
- `alembic upgrade head` creates both tables

**Acceptance Criteria:**
- [ ] `alembic upgrade head` runs cleanly against SQLite and PostgreSQL
- [ ] All PKs are UUIDs (no integer sequences)
- [ ] `DecisionRecord` and `AuditLog` are queryable via async session
- [ ] `alembic downgrade base` reverses cleanly

---

### Story 1.3 — Feature Engineering Module
**As a** backend service, **I want** deterministic feature transforms **so that** raw applicant inputs become consistent model features, invertible for explainability.
**Points**: 3

**Tasks:**
- Implement `app/shared/feature_engineering.py`:
  - `FEATURES` list: `income_log`, `employment_length`, `housing_encoded`, `credit_score_imputed`, `thin_file_flag`, `dti_ratio`, `income_band`
  - `transform(raw: dict) -> dict` — applies all transforms
  - `income_log`: `log1p(income)`
  - `housing_encoded`: `own=2`, `mortgage=1`, `rent=0`
  - `credit_score_imputed`: if `None` → `620` (store imputation constant, do not hard-code inline)
  - `thin_file_flag`: `1` if `credit_score` is `None`, else `0`
  - `income_band`: `0` if `<25k`, `1` if `25-50k`, `2` if `50-100k`, `3` if `>100k`
- All imputation constants stored in a `CONFIG` dict at module level (not magic numbers)
- Unit tests in `tests/test_feature_engineering.py`

**Acceptance Criteria:**
- [ ] `transform()` is pure (no side effects, same input → same output always)
- [ ] `thin_file_flag=1` when `credit_score=None`
- [ ] `housing_encoded` correctly maps all three values
- [ ] 5 unit tests pass covering edge cases (null score, min/max income, each housing type)

---

### Story 1.4 — Rules Engine
**As a** compliance system, **I want** hard rules evaluated before ML scoring **so that** FCRA-mandated rejections are applied consistently and produce compliant reason codes.
**Points**: 3

**Tasks:**
- Implement `app/shared/rules_engine.py`:
  - `RULES` list with 4 rules (in priority order):
    1. `minimum_income`: income < 18,000 → `reject` / `INCOME_BELOW_MINIMUM` / `AA-01`
    2. `negative_employment`: `employment_length < 0` → `reject` / `INVALID_EMPLOYMENT_DATA` / `AA-09`
    3. `very_low_credit_score`: score present and < 500 → `reject` / `CREDIT_SCORE_TOO_LOW` / `AA-02`
    4. `thin_file_review`: score absent and income < 40,000 → `review` / `THIN_FILE_LOW_INCOME` / `AA-07`
  - `evaluate(features: dict) -> RuleResult | None` — returns first triggering rule or `None`
  - `RuleResult` dataclass: `rule_name`, `decision`, `reason_code`, `fcra_code`
- Unit tests: each rule fires on correct input; no rule fires on clean input

**Acceptance Criteria:**
- [ ] Income = 15,000 → `reject` / `AA-01`
- [ ] Credit score = 490, present → `reject` / `AA-02`
- [ ] Credit score = None, income = 35,000 → `review` / `AA-07`
- [ ] Income = 80,000, score = 720 → `None` (no rule fires)
- [ ] Rules cannot fire out of priority order

---

### Story 1.5 — Mock ML Model + Underwriting Service
**As a** developer, **I want** a deterministic rule-based mock that mimics an ML model's outputs **so that** the full API contract can be validated before the real model is trained.
**Points**: 5

**Tasks:**
- Implement `app/modules/underwriting/model.py` — `MockUnderwritingModel` class:
  - `predict(features: dict) -> dict`: probability derived from a weighted sum of features (deterministic — no randomness)
  - Returns `{ "probability": float, "decision": str, "confidence_score": float }`
  - `confidence_score = abs(probability - 0.5) * 2`
  - `compute_credit_terms(probability, income)`:
    - `base_limit = min(income * 0.15, 25_000)`
    - `adjusted_limit = round((base_limit * (0.5 + probability * 0.5)) / 500) * 500`
    - APR tiers: `<0.3→29.99`, `0.3–0.5→24.99`, `0.5–0.7→19.99`, `>0.7→14.99`
  - `compute_shap(features: dict) -> dict[str, float]`: mock values proportional to feature weights
- Implement `app/modules/underwriting/service.py` — `UnderwritingService.decide(request)`:
  1. Transform features
  2. Evaluate rules (if rule fires → bypass model)
  3. Call model
  4. Compute credit terms
  5. Persist `DecisionRecord` + `AuditLog` to DB
  6. Return fully populated response

**Acceptance Criteria:**
- [ ] Same input always produces same output (deterministic)
- [ ] Rules override model when triggered
- [ ] `DecisionRecord` row written to DB on every call
- [ ] `AuditLog` row written with `event_type="decision_made"`
- [ ] Credit limit is always rounded to nearest $500

---

### Story 1.6 — POST /api/underwriting/decision Endpoint
**As a** frontend developer, **I want** a working `POST /api/underwriting/decision` endpoint **so that** the lab UI can display real decisions from day one.
**Points**: 5

**Tasks:**
- Implement `app/modules/underwriting/schemas.py`:
  - `UnderwritingRequest`: `income (float, >0)`, `employment_length (float, ≥0)`, `housing_status (Literal["own","mortgage","rent"])`, `credit_score (Optional[int] 300–850)`, `scenario_tag (Optional[str])`, `demo_mode (bool default False)`
  - `UnderwritingResponse`: full contract from `CODING_PROMPT.md §4.5`
  - `AuditSummary` nested model
- Implement `app/modules/underwriting/api.py` — FastAPI router, `POST /decision`
- Wire router into `main.py` under prefix `/api/underwriting`
- Global exception handler → RFC 7807 `ProblemDetail` response
- Demo mode: if `demo_mode=True`, return from `DEMO_RESPONSES` dict keyed on `scenario_tag`; still write to DB with `demo_mode=True`

**Acceptance Criteria:**
- [ ] `POST /api/underwriting/decision` with valid payload → 200 + full response JSON
- [ ] `income = -1` → 422 with RFC 7807 body
- [ ] `housing_status = "condo"` → 422
- [ ] `demo_mode=true` + `scenario_tag="thin_file"` → deterministic response every time
- [ ] Response always contains `decision_id` (UUID), `audit.timestamp` (ISO 8601 UTC), `audit.model_version`
- [ ] Manual curl test documented in sprint review notes

---

### Story 1.7 — Demo Mode Response Map
**As a** demo operator, **I want** deterministic, pre-computed responses for each scenario **so that** demos never depend on live inference.
**Points**: 2  *(rolled into 1.6 implementation — tracked separately for visibility)*

**Tasks:**
- Implement `DEMO_RESPONSES` dict in `app/modules/underwriting/service.py` for: `prime_applicant`, `near_prime`, `thin_file`, `gig_worker`, `new_immigrant`, `high_risk`
- Each entry: `decision`, `credit_limit`, `apr`, `confidence_score`, `risk_segment`, `reason_codes`, mock `explanations` (SHAP values)
- Demo responses still write to `decisions` table with `demo_mode=True`

**Acceptance Criteria:**
- [ ] Each of the 6 scenario tags returns the correct pre-defined decision
- [ ] Unknown `scenario_tag` with `demo_mode=True` returns a safe fallback (`near_prime`)
- [ ] DB record has `demo_mode=True`

---

**Sprint 1 Review Checklist:**
- [ ] `GET /api/health` → 200
- [ ] `POST /api/underwriting/decision` → 200 with full contract response
- [ ] Decision persisted in SQLite — verify with SQLite browser or raw query
- [ ] Demo mode returns deterministic responses for all 6 scenarios
- [ ] All pytest tests pass: `pytest tests/`

---

---

# SPRINT 2 — Typed API Client + Basic Lab UI
**Theme**: Connect the frontend to the live backend. Functional (not yet beautiful) lab pages.
**Duration**: Days 4–5 · **Capacity**: 22 points
**Sprint Goal**: A user can open `/lab/underwriting`, fill in applicant fields, submit, and see a real decision from the backend rendered in the UI.

---

### Story 2.1 — Typed API Client (`src/lib/api.ts`)
**As a** frontend developer, **I want** a typed API client **so that** all backend calls are centralized, typed, and resilient.
**Points**: 3

**Tasks:**
- Create `src/lib/api.ts`:
  - `ApiError` class extending `Error`: `status`, `title`, `detail`, `instance`
  - `apiFetch<T>(path, options)` wrapper: base URL from `NEXT_PUBLIC_API_URL`, 15s `AbortController` timeout, auto-inject Firebase ID token as `Authorization: Bearer <token>`, single retry on 502/503/504 with 500ms delay, parse RFC 7807 error → throw `ApiError`
- Export `apiClient` object:
  ```
  apiClient.underwriting.decide(payload) → Promise<UnderwritingResponse>
  apiClient.underwriting.history(params) → Promise<PaginatedResponse<DecisionRecord>>
  apiClient.copilot.explain(payload)    → Promise<CopilotResponse>
  apiClient.governance.dashboard(period) → Promise<GovernanceDashboard>
  apiClient.governance.biasReport()     → Promise<BiasReport>
  ```
- All request/response types defined as TypeScript interfaces in `src/lib/types.ts`
- Zod schemas co-located for runtime validation of responses

**Acceptance Criteria:**
- [ ] No `any` types in `api.ts` or `types.ts`
- [ ] Network timeout after 15s throws `ApiError` with `status=408`
- [ ] 401 response clears auth and redirects to `/login`
- [ ] `npm run build` passes with `api.ts` present

---

### Story 2.2 — Lab Layout + Navigation Shell
**As a** user, **I want** a lab shell with sidebar navigation **so that** I can move between Underwriting, Copilot, and Governance without losing context.
**Points**: 3

**Tasks:**
- Create `src/app/lab/layout.tsx`:
  - Protected by existing `withAuth` HOC
  - Left sidebar (240px desktop, drawer mobile) with nav links: Product Lab index, Underwriting Engine, AI Copilot, Governance
  - `DemoModeContext` provider — reads/writes `localStorage` key `agentHive_demoMode`
  - Active route highlighted
  - Breadcrumb component at top of content area
- Create `src/app/lab/page.tsx` — product selector landing (3 cards linking to each tool)
- Demo Mode toggle component (`DemoModeToggle.tsx`) — amber pill, persists state

**Acceptance Criteria:**
- [ ] Unauthenticated users redirected to `/login`
- [ ] Sidebar nav links navigate correctly
- [ ] Demo Mode toggle persists to `localStorage` across page refreshes
- [ ] Breadcrumb shows correct path on all three lab sub-pages
- [ ] Sidebar collapses to icon-only on mobile

---

### Story 2.3 — InputPanel Component
**As a** demo user, **I want** an applicant profile form **so that** I can input financial data and submit it for decisioning.
**Points**: 5

**Tasks:**
- Create `src/components/lab/InputPanel.tsx`:
  - Form powered by React Hook Form + Zod: `income (number, 1000–999999)`, `employment_length (number, 0–30)`, `housing_status (enum)`, `credit_score (nullable 300–850)`
  - Currency-formatted income input with comma separators
  - `employment_length` shadcn Slider (0–30 years)
  - `housing_status` shadcn Select with three options
  - Credit score input with "No credit history (thin file)" checkbox — when checked, field disables and value set to `null`
  - Inline Zod validation errors (not toasts)
  - Submit button: idle="Run Decision", loading="Analysing…" + spinner, fully disabled during fetch
- Create `src/components/lab/ScenarioSelector.tsx`:
  - 6 scenario cards (2×3 grid) per `CODING_PROMPT.md §5.3`
  - Clicking a card populates all form fields

**Acceptance Criteria:**
- [ ] Form validates before submit (required fields, range checks)
- [ ] Scenario cards pre-fill all fields correctly
- [ ] Income displays formatted ("75,000") but submits as number (75000)
- [ ] Thin-file checkbox disables score field and sets `credit_score: null`
- [ ] Form fully disabled (not just button) during loading

---

### Story 2.4 — OutputPanel Component
**As a** demo user, **I want** to see the credit decision rendered clearly **so that** I can understand approve/reject/review outcomes at a glance.
**Points**: 5

**Tasks:**
- Create `src/components/lab/OutputPanel.tsx`:
  - **Empty state**: dashed border card, centered icon + instructional text
  - **Loading state**: three skeleton cards (matching layout of result) with `animate-pulse`
  - **Result state**:
    - Decision hero card: `border-l-4` green/red/amber + decision icon + decision label `text-2xl font-bold`
    - Confidence progress bar + label ("High Confidence ≥0.75", "Moderate 0.5–0.75", "Low <0.5")
    - Terms row: Credit Limit | APR | Risk Segment (all three in cards, dimmed if rejected)
    - Reason codes: `Badge` chips with `Tooltip` showing plain-English explanation
    - Decision ID: monospace, click-to-copy with toast confirmation
    - Elapsed time: measured client-side, displayed in ms
- Create `src/components/shared/DecisionBadge.tsx`: variants `success` / `destructive` / `warning`

**Acceptance Criteria:**
- [ ] Skeleton shown during fetch (not spinner overlay)
- [ ] Correct border colour for each of approve/reject/review
- [ ] Credit limit + APR dimmed (opacity-40) on reject
- [ ] Click decision_id → copies to clipboard → toast "Decision ID copied"
- [ ] Elapsed time displayed to nearest millisecond

---

### Story 2.5 — Underwriting Page (wired end-to-end)
**As a** user, **I want** `/lab/underwriting` to be fully functional **so that** I can submit a profile and see a complete decision with explanation.
**Points**: 3

**Tasks:**
- Create `src/app/lab/underwriting/page.tsx`:
  - CSS Grid layout: `lg:grid-cols-[380px_1fr]` split
  - Left: `<InputPanel>` with `<ScenarioSelector>` above form
  - Right: `<OutputPanel>`
  - Context bar: breadcrumb + demo mode pill + model version `v1.0.0` badge
  - Wire form submit → `apiClient.underwriting.decide()` → pass result to `OutputPanel`
  - Handle `ApiError`: show inline error card (not toast) with `title` and `detail` from RFC 7807 response

**Acceptance Criteria:**
- [ ] Full round-trip: submit → API call → decision displayed (happy path)
- [ ] API error (e.g. backend down) → error card shown, form re-enabled
- [ ] Demo mode uses `demo_mode: true` in request payload
- [ ] Scenario "High-Risk Profile" → red `Reject` decision card

---

**Sprint 2 Review Checklist:**
- [ ] End-to-end demo: fill in form → submit → see decision in OutputPanel
- [ ] All 6 scenario presets populate the form correctly
- [ ] Demo mode confirmed (toggle on → deterministic responses)
- [ ] Error state confirmed (stop backend → error card appears)
- [ ] `npm run build` passes

---

---

# SPRINT 3 — ML Intelligence + SHAP + Copilot
**Theme**: Replace the mock model with a real trained ML pipeline. Add SHAP explainability and the AI Copilot page.
**Duration**: Days 6–9 · **Capacity**: 34 points
**Sprint Goal**: The platform makes real ML-powered decisions, shows factor importance charts, and the AI Copilot delivers natural language explanations.

---

### Story 3.1 — Synthetic Training Data Generator
**As a** ML engineer, **I want** a reproducible synthetic dataset **so that** the underwriting model can be trained without requiring real borrower data.
**Points**: 3

**Tasks:**
- Implement `app/modules/underwriting/data_generator.py`:
  - `generate(n=10_000, seed=42) -> pd.DataFrame`
  - Realistic distributions: income log-normal (mean=$65k, std=$35k), employment gamma (shape=2, scale=3), credit score beta-scaled 500–850 (30% thin-file with `None`)
  - Labels: approval probability derived from weighted combination of features + Bernoulli sample → target approval rate ~68%
  - `python -m app.modules.underwriting.data_generator --output data/synthetic_train.csv`

**Acceptance Criteria:**
- [ ] `seed=42` always generates identical data
- [ ] Approval rate between 65–71% across 10,000 samples
- [ ] ~30% of rows have `credit_score = None`
- [ ] No negative incomes or impossible credit scores in output

---

### Story 3.2 — Real ML Model (Scikit-learn Pipeline)
**As a** decisioning system, **I want** a trained LogisticRegression pipeline **so that** decisions are based on learned patterns rather than hand-coded rules.
**Points**: 5

**Tasks:**
- Implement `app/modules/underwriting/model.py` — `UnderwritingModel` class:
  - `Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42))])`
  - `train(df: pd.DataFrame)` — fits pipeline, computes and logs AUC-ROC, Gini, KS statistic, approval rate
  - `save(path)` — `joblib.dump(pipeline, path)` + writes SHA256 hash to `path.sha256`
  - `load(path)` — `joblib.load(path)`, reads hash, verifies integrity
  - `predict(features: dict) -> dict` — returns `probability`, `decision` (threshold 0.5), `confidence_score`
  - `compute_credit_terms(probability, income) -> dict` — same formula as mock model
  - CLI: `python -m app.modules.underwriting.model --train --output models/underwriting_v1.pkl`
- Replace `MockUnderwritingModel` with `UnderwritingModel` in `service.py`; set `MODEL_VERSION = "1.0.0"`

**Acceptance Criteria:**
- [ ] AUC-ROC ≥ 0.75 on 20% holdout
- [ ] Serialized artifact: `models/underwriting_v1.pkl`; corresponding `models/underwriting_v1.pkl.sha256`
- [ ] Integrity check raises `ValueError` if artifact is tampered with
- [ ] `model_version` in API response reflects SHA256 hash prefix (`sha256:<first 12 chars>`)
- [ ] Model loaded once at app startup (not per request)

---

### Story 3.3 — SHAP Explainability
**As a** compliance officer, **I want** SHAP feature importance values in every decision response **so that** I can explain any credit decision to a regulator or applicant.
**Points**: 5

**Tasks:**
- Implement `app/shared/explainability.py` — `SHAPExplainer` class:
  - Uses `shap.LinearExplainer(pipeline["clf"], background_data)` on load
  - `explain(features: dict) -> dict[str, float]`: transform features → run SHAP → return `{feature_name: shap_value}` for all features in `FEATURES`
  - Signed values: positive = supports approval, negative = hurts approval
  - Background data: first 200 rows of training data (stored alongside model artifact)
- Wire into `UnderwritingService.decide()` — SHAP computed after ML prediction
- Persist `shap_values` JSON to `DecisionRecord`

**Acceptance Criteria:**
- [ ] All 7 feature names present in `explanations` dict
- [ ] Values are signed floats (not absolute)
- [ ] `thin_file_flag` SHAP value is negative when `credit_score` is `None`
- [ ] SHAP computation adds < 100ms overhead (benchmark and log)
- [ ] SHAP values persist to `decisions.shap_values` column

---

### Story 3.4 — ExplanationPanel Component
**As a** user, **I want** a SHAP factor importance chart **so that** I can see at a glance which factors drove the credit decision.
**Points**: 5

**Tasks:**
- Create `src/components/lab/ExplanationPanel.tsx`:
  - Recharts `BarChart` with `layout="vertical"` inside `ResponsiveContainer`
  - Bars sorted by absolute SHAP value (highest at top)
  - Positive bars: emerald fill (`#10b981`); negative bars: red fill (`#ef4444`)
  - Y-axis: human-readable feature names (map from API keys)
  - Custom tooltip: `"Annual Income: +0.42 (strong positive signal)"`
  - `ReferenceLine x={0}` — dashed zinc-700 center divider
  - `animationDuration=800` `animationBegin=0`
  - Info icon with `Tooltip`: "SHAP values show each factor's contribution. Positive = supports approval."
  - `role="img"` `aria-label` describing chart content (accessibility)
  - `ResponsiveContainer` min-width 280px (works at 320px viewport)
- Wire into `/lab/underwriting/page.tsx` below the grid

**Acceptance Criteria:**
- [ ] Chart renders for every decision (approve, reject, review)
- [ ] Bars animate in on mount
- [ ] Sorted by absolute value (largest bar at top)
- [ ] Custom tooltip shows feature label + signed value + plain-English qualifier
- [ ] Readable at 320px viewport (no label clipping)

---

### Story 3.5 — POST /api/copilot/explain Endpoint
**As a** credit analyst, **I want** a copilot endpoint that generates a natural language narrative **so that** I can explain decisions to applicants and colleagues without reading raw JSON.
**Points**: 3

**Tasks:**
- Implement `app/modules/copilot/service.py` — `CopilotService.explain(decision_response, applicant_context)`:
  - Build structured prompt from decision response fields
  - Try OpenAI `gpt-4o-mini` if `OPENAI_API_KEY` is set; otherwise use deterministic mock
  - Mock output: template-filled string using decision fields (no LLM dependency required)
  - Returns: `{ narrative, risk_flags, recommendations, plain_english_apr }`
  - `plain_english_apr`: `f"For every $1,000 balance, you'd pay approximately ${apr/12:.2f}/month in interest"`
- Implement `app/modules/copilot/api.py` — `POST /explain` router
- Wire into `main.py` under prefix `/api/copilot`

**Acceptance Criteria:**
- [ ] Works with `OPENAI_API_KEY` absent (mock fallback, deterministic output)
- [ ] `narrative` ≤ 3 sentences
- [ ] `risk_flags` ≤ 3 items
- [ ] `recommendations` ≤ 3 items
- [ ] `plain_english_apr` correct to nearest cent (test APR=19.99 → $16.66/mo per $1k)
- [ ] No hallucinated numbers — only values from the input decision response used

---

### Story 3.6 — AI Copilot Page (`/lab/copilot`)
**As a** credit analyst, **I want** the AI Copilot UI **so that** I can see natural language explanations, risk flags, and recommendations alongside a decision.
**Points**: 5

**Tasks:**
- Create `src/app/lab/copilot/page.tsx`:
  - Same `InputPanel` + `ScenarioSelector` as underwriting page
  - On submit: call `apiClient.underwriting.decide()` then `apiClient.copilot.explain(response)`
  - Show `OutputPanel` (compact — same component, reuse) above copilot narrative
- Create `src/components/lab/CopilotNarrative.tsx`:
  - Card with bot icon + "Copilot Analysis" heading + "Powered by Gemini" badge (monospace xs)
  - Narrative text: character-by-character render effect (useState + setInterval, 8ms/char)
  - Numbers/percentages highlighted in `font-mono text-brand-300` via regex parse
  - Risk Flags: amber `AlertTriangle` icon per flag, bg-amber-950/30 rounded-lg padding
  - Recommendations: numbered list with `ChevronRight` icon per item
  - Plain-English APR explainer: info box at bottom

**Acceptance Criteria:**
- [ ] Typewriter effect renders narrative smoothly (no jank)
- [ ] Risk flags shown in amber boxes
- [ ] Recommendations shown as numbered list
- [ ] APR explainer box present with correct calculation
- [ ] Loading state: skeleton while both API calls complete
- [ ] Error state: shows `ApiError.detail` if either call fails

---

### Story 3.7 — AuditPanel Component
**As a** compliance officer, **I want** a collapsible audit trail panel **so that** I can verify model version, rules triggered, and decision timestamp for any decision.
**Points**: 3

**Tasks:**
- Create `src/components/lab/AuditPanel.tsx`:
  - shadcn/ui `Collapsible` — collapsed by default
  - Header: `[ChevronDown] "Audit Trail"` + model version chip + timestamp chip
  - Expanded: `bg-zinc-950` container, `font-mono text-xs text-zinc-400 leading-6`
  - Two-column key/value layout (key left-padded, value right-aligned in monospace)
  - Fields: `decision_id`, `model_version`, `artifact_hash`, `rules_evaluated`, `rules_triggered`, `demo_mode`, `timestamp`, `elapsed_ms`
  - "Copy full audit JSON" ghost button → copies entire audit object as formatted JSON
- Wire into `/lab/underwriting/page.tsx` below ExplanationPanel

**Acceptance Criteria:**
- [ ] Panel collapsed by default, expands on click
- [ ] All 8 audit fields rendered
- [ ] "Copy full audit JSON" copies correctly formatted JSON
- [ ] Model version + timestamp displayed in collapsed header chips
- [ ] `demo_mode: true` shown in amber text when active

---

**Sprint 3 Review Checklist:**
- [ ] End-to-end: real ML decision returned (not mock)
- [ ] AUC-ROC ≥ 0.75 confirmed in training logs
- [ ] SHAP chart renders correctly for all 6 scenarios
- [ ] AI Copilot narrative generates for all decision types
- [ ] Audit panel shows correct model version hash
- [ ] `pytest tests/` all pass

---

---

# SPRINT 4 — Governance APIs + Genkit LLM Flow
**Theme**: Governance dashboard backend + Gemini-powered narrative via Genkit server actions.
**Duration**: Days 10–12 · **Capacity**: 30 points
**Sprint Goal**: The Governance Dashboard is fully data-backed. The AI Copilot uses Gemini for real LLM narratives via Genkit.

---

### Story 4.1 — GET /api/underwriting/history (Paginated)
**As a** governance user, **I want** paginated decision history **so that** I can audit past decisions and filter by outcome.
**Points**: 3

**Tasks:**
- Implement `GET /api/underwriting/history` in `app/modules/underwriting/api.py`:
  - Query params: `page (int ≥1, default 1)`, `page_size (int 1–100, default 10)`, `decision (optional: approve|reject|review)`, `demo_mode (optional bool)`, `segment (optional str)`
  - Async SQLAlchemy paginated query on `DecisionRecord`
  - Response: `{ items: DecisionRecord[], total: int, page: int, pages: int, page_size: int }`
  - `items`: full `DecisionRecord` minus `input_payload` (PII) — add a `DecisionSummary` response model
- Pytest: test pagination boundaries, decision filter, demo_mode filter

**Acceptance Criteria:**
- [ ] `?page=2&page_size=5` returns correct offset records
- [ ] `?decision=reject` returns only rejected decisions
- [ ] `?demo_mode=false` excludes demo records
- [ ] `total` reflects filtered count, not table total
- [ ] Empty result: `{ items: [], total: 0, page: 1, pages: 0 }`

---

### Story 4.2 — GET /api/governance/dashboard
**As a** risk manager, **I want** aggregated governance metrics **so that** I can monitor approval rates, credit terms, and rule triggers in one view.
**Points**: 5

**Tasks:**
- Implement `app/modules/governance/service.py` — `GovernanceDashboardService.get(period)`:
  - `period`: `"last_7_days"` | `"last_30_days"` | `"last_90_days"` | `"all_time"`
  - Async aggregation queries on `DecisionRecord`:
    - `total_decisions`, `approval_rate` (approve / total), `average_credit_limit`, `average_apr`
    - `decisions_by_segment` (count per `risk_segment`)
    - `approval_rate_by_segment` (approval rate per segment)
    - `rules_triggered_frequency` (count per rule name in `rules_triggered` JSON)
    - `top_reason_codes` (top 5, with count + % of total)
    - `approval_rate_by_day` (array of `{date, rate, count}` for sparklines)
  - Exclude `demo_mode=True` records from all metrics

**Acceptance Criteria:**
- [ ] Returns 200 with all required fields populated
- [ ] `approval_rate` = 0 when all decisions are rejected
- [ ] Period filtering correctly bounds `created_at` window
- [ ] Demo records excluded from all aggregations
- [ ] Response time < 300ms on 10,000 records (add DB index on `created_at`)

---

### Story 4.3 — GET /api/governance/bias-report
**As a** compliance officer, **I want** an adverse impact report **so that** I can monitor whether the model exhibits disparate impact across income bands.
**Points**: 3

**Tasks:**
- Implement `GovernanceDashboardService.bias_report()`:
  - Compute approval rate per income band (from `input_payload.income`)
  - `adverse_impact_ratio` = lowest band approval rate ÷ highest band approval rate
  - `disparate_impact_flag` = `True` if ratio < 0.8 (four-fifths rule)
  - Return full `BiasReport` schema (see `CODING_PROMPT.md §4.5`)
  - Prepend `disclaimer` field — mandatory, non-optional
- Implement `GET /api/governance/bias-report` endpoint

**Acceptance Criteria:**
- [ ] `disclaimer` field always present in response
- [ ] `disparate_impact_flag=True` when lowest/highest ratio < 0.8
- [ ] Works with < 10 decisions (graceful empty band handling)
- [ ] `income_band_analysis` has all four bands, each with `total`, `approved`, `rate`

---

### Story 4.4 — Governance Dashboard UI (`/lab/governance`)
**As a** risk manager, **I want** the governance dashboard **so that** I can monitor decisions, approval rates, and bias indicators in a single view.
**Points**: 8

**Tasks:**
- Create `src/app/lab/governance/page.tsx` with three tabs (shadcn/ui `Tabs`):

  **Tab 1 — Overview:**
  - 4 KPI cards: Total Decisions, Approval Rate, Avg Credit Limit, Avg APR
  - Period selector (`Select`): Last 7 Days / Last 30 Days / Last 90 Days / All Time
  - Approval rate by segment — horizontal `BarChart` (Recharts)
  - Rules triggered frequency — vertical `BarChart`

  **Tab 2 — Decision History:**
  - Create `src/components/governance/DecisionHistoryTable.tsx`:
    - Calls `apiClient.underwriting.history()` with filters
    - Columns: Time (relative) | Decision (`DecisionBadge`) | Credit Limit | APR | Segment | Rules | Actions
    - Filter bar: Decision dropdown, Segment dropdown, search by decision_id (partial)
    - Pagination: 10/page, prev/next with `"Showing X–Y of Z"` in `font-mono text-xs`
    - Row "View" button → shadcn/ui `Sheet` showing full decision JSON

  **Tab 3 — Bias Report:**
  - Create `src/components/governance/BiasIndicatorChart.tsx`
  - Amber disclaimer `Alert` banner (non-dismissable)
  - Adverse impact ratio card: large number coloured red if < 0.8, green if ≥ 0.8
  - `Popover` explainer: plain-English explanation of the four-fifths rule
  - Income band stacked `BarChart`: approved vs rejected per band

**Acceptance Criteria:**
- [ ] All three tabs render data from live API
- [ ] Period selector triggers re-fetch and updates all metrics
- [ ] Decision table pagination works correctly
- [ ] Sheet shows full decision JSON with all fields
- [ ] Bias report disclaimer always visible
- [ ] `adverse_impact_ratio` coloured correctly (red < 0.8)

---

### Story 4.5 — Genkit LLM Flow: `credit-copilot-flow.ts`
**As a** engineering team, **I want** the AI Copilot narrative generated via a Genkit server action **so that** LLM calls stay in the Next.js layer and use the existing Gemini 2.0 Flash configuration.
**Points**: 5

**Tasks:**
- Create `src/ai/flows/credit-copilot-flow.ts`:
  - Input schema: `UnderwritingResponse` (typed from `src/lib/types.ts`) + `applicant_context: string`
  - Output schema: `CopilotNarrativeOutput { narrative, risk_flags, recommendations, plain_english_apr }`
  - Prompt persona: "You are a credit analyst at a regulated consumer lending institution."
  - Prompt constraints: max 3 sentences narrative, max 3 risk flags, max 3 recommendations; no hallucinated numbers; FCRA-compliant (no reason codes without plain-English); empathetic tone on reject
  - Export `getCreditCopilotNarrative(input)` as server action
- Replace FastAPI copilot HTTP call with direct Genkit server action call in `CopilotNarrative.tsx`

**Acceptance Criteria:**
- [ ] Narrative contains no numbers not present in input decision
- [ ] Rejected decisions: narrative includes actionable improvement path
- [ ] Narrative ≤ 3 sentences (enforced via Zod output validation)
- [ ] `plain_english_apr` matches formula: `apr/12 * (1000/100)`
- [ ] Fallback to deterministic mock template if Gemini call fails
- [ ] Server action works from `use client` component via server action boundary

---

**Sprint 4 Review Checklist:**
- [ ] All three governance tabs load with live data
- [ ] Decision history table paginates correctly
- [ ] Bias report shows correctly coloured adverse impact ratio
- [ ] Copilot narrative generated by Gemini (verify in network tab — no FastAPI call)
- [ ] `pytest tests/test_governance.py` passes

---

---

# SPRINT 5 — Backend Hardening + Tests + Docker
**Theme**: Production-readiness. Real LLM, PostgreSQL, containerisation, and test coverage.
**Duration**: Days 13–14 · **Capacity**: 20 points
**Sprint Goal**: The backend can run in Docker against PostgreSQL, OpenAI integration is live with fallback, and test coverage is sufficient for a production handoff.

---

### Story 5.1 — OpenAI Copilot Integration (with Fallback)
**As a** system, **I want** the FastAPI copilot service to call OpenAI when a key is available **so that** the backend can also generate LLM narratives independently of the Next.js layer.
**Points**: 3

**Tasks:**
- Update `app/modules/copilot/service.py`:
  - Try `openai.AsyncOpenAI().chat.completions.create(model="gpt-4o-mini", ...)` when `OPENAI_API_KEY` is set
  - Structured system + user prompt constructed from decision fields
  - Parse response into `CopilotResponse` shape
  - On exception (rate limit, timeout, key absent): return deterministic mock
  - Log: `"copilot_source": "openai"` or `"mock"` in structured log

**Acceptance Criteria:**
- [ ] With key: response is LLM-generated (verify non-determinism across two calls)
- [ ] Without key: mock response returned, no exception raised
- [ ] Mock response passes same schema validation as LLM response
- [ ] OpenAI timeout < 10s (set `timeout=9.0` in client)

---

### Story 5.2 — PostgreSQL + Alembic Migration
**As an** ops engineer, **I want** Alembic migrations that work against PostgreSQL **so that** the database can be managed safely in staging and production.
**Points**: 3

**Tasks:**
- Verify `0001_initial_schema.py` runs cleanly against PostgreSQL 16
- Create `0002_add_indexes.py` migration:
  - `idx_decisions_created_at` on `decisions.created_at DESC`
  - `idx_decisions_decision` on `decisions.decision`
  - `idx_decisions_demo_mode` on `decisions.demo_mode`
  - `idx_audit_logs_decision_id` on `audit_logs.decision_id`
- Test: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

**Acceptance Criteria:**
- [ ] `alembic upgrade head` idempotent (run twice = no error)
- [ ] `alembic downgrade base` drops all tables cleanly
- [ ] All 4 indexes created and verified with `\d decisions` in psql
- [ ] Query planner uses `idx_decisions_created_at` for history endpoint (verify with `EXPLAIN ANALYZE`)

---

### Story 5.3 — Docker + docker-compose
**As a** developer, **I want** a docker-compose setup **so that** anyone can run the full backend stack locally with one command.
**Points**: 3

**Tasks:**
- Write `backend/Dockerfile`:
  - Multi-stage: `python:3.11-slim` build stage, copy only requirements + app, no dev deps
  - Non-root user `appuser`
  - `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
- Write `backend/docker-compose.yml`:
  - Services: `api` (FastAPI), `db` (postgres:16-alpine)
  - `db`: volume for data persistence, healthcheck
  - `api`: depends_on db healthcheck, env vars from `.env`, maps port 8000
  - `alembic upgrade head` run via `docker-compose run api alembic upgrade head`
- `README.md` section: "Run with Docker" (3-command quickstart)

**Acceptance Criteria:**
- [ ] `docker-compose up --build` starts both services without error
- [ ] `POST /api/underwriting/decision` works against Dockerised PostgreSQL
- [ ] Restarting `api` container without restarting `db` preserves decision history
- [ ] Image size < 500MB

---

### Story 5.4 — Pytest Test Suite
**As a** team, **I want** a baseline test suite **so that** regressions are caught before they reach the demo environment.
**Points**: 5

**Tasks:**
- `tests/conftest.py`: async test client, in-memory SQLite test DB, fixtures for mock model
- `tests/test_underwriting.py`:
  - `test_decision_approve`: income=80k, score=720 → approve
  - `test_decision_reject_income`: income=15k → reject / AA-01
  - `test_decision_reject_low_score`: score=490 → reject / AA-02
  - `test_decision_thin_file_review`: score=None, income=35k → review / AA-07
  - `test_decision_demo_mode`: `demo_mode=True`, `scenario_tag="prime_applicant"` → deterministic response
  - `test_invalid_housing_status`: `housing_status="condo"` → 422
  - `test_response_has_uuid_decision_id`
  - `test_db_record_created_after_decision`
- `tests/test_governance.py`:
  - `test_history_pagination`
  - `test_history_filter_by_decision`
  - `test_governance_dashboard_returns_all_fields`
  - `test_bias_report_disclaimer_present`
  - `test_adverse_impact_ratio_calculation`

**Acceptance Criteria:**
- [ ] All tests pass: `pytest tests/ -v`
- [ ] No test hits the real OpenAI API (mock patched via `pytest-mock`)
- [ ] Test DB is isolated — no shared state between tests
- [ ] `pytest --tb=short` output is clean (no warnings as errors unless intentional)

---

### Story 5.5 — Staging Environment Variables + .env.example
**As a** developer onboarding to the project, **I want** a complete `.env.example` **so that** I can set up the full stack locally without needing to ask the team.
**Points**: 2

**Tasks:**
- Write `backend/.env.example` with all vars from `CODING_PROMPT.md §9`, every key commented
- Write `frontend/.env.local.example` with all `NEXT_PUBLIC_*` + `GOOGLE_GENAI_API_KEY`
- Update root `README.md`: "Local Setup" section with step-by-step instructions (backend + frontend)

**Acceptance Criteria:**
- [ ] Following `.env.example` instructions verbatim results in a working local stack
- [ ] No real secrets in `.env.example` (replaced with `your_key_here` placeholders)
- [ ] README instructions tested on a clean machine / fresh terminal session

---

**Sprint 5 Review Checklist:**
- [ ] `docker-compose up --build` → both services healthy
- [ ] `pytest tests/ -v` → all tests pass
- [ ] `POST /api/underwriting/decision` against Dockerised Postgres → decision persisted
- [ ] README "Local Setup" followed on clean terminal → system functional

---

---

# SPRINT 6 — Design System + Navbar + Homepage
**Theme**: Begin world-class UI rebuild. Foundation tokens, global shell, and homepage redesign.
**Duration**: Days 15–18 · **Capacity**: 36 points
**Sprint Goal**: The homepage looks like it belongs next to Mercury Bank and Stripe. The design system tokens are live and used consistently across the shell.

---

### Story 6.1 — Design System Tokens + Font Setup
**As a** frontend developer, **I want** the design tokens from `CODING_PROMPT.md §8.1` configured **so that** every component can use consistent colour, typography, and spacing.
**Points**: 3

**Tasks:**
- Extend `tailwind.config.ts`:
  - Add full `brand` (50–950), `approve`, `reject`, `review`, `surface`, `data` color scales
  - Add `fontFamily`: `heading: ["Space Grotesk"]`, `body: ["Inter"]`, `mono: ["Geist Mono", "ui-monospace"]`
- Update `src/app/layout.tsx`:
  - Add `next/font/google` for Geist Mono (import `GeistMono` from `"geist/font/mono"` or Google Fonts CDN)
  - Apply `font-body antialiased` on `<body>`
  - Dark mode default confirmed (existing `ThemeProvider` already handles this)
- Install: `npm install framer-motion`
- Create `src/lib/animations.ts`:
  - `fadeInUp`, `fadeInDown`, `staggerChildren`, `scaleIn` variants (exact values from `CODING_PROMPT.md §8.8`)
  - Export `shouldReduceMotion()` helper checking `window.matchMedia("(prefers-reduced-motion: reduce)")`

**Acceptance Criteria:**
- [ ] `bg-brand-500` renders electric blue (`#3366f4`) in browser
- [ ] `bg-surface-base` renders zinc-950 (`#09090b`)
- [ ] `font-mono` renders Geist Mono on all numeric elements
- [ ] `framer-motion` version installed and importable
- [ ] `src/lib/animations.ts` fully typed, no `any`

---

### Story 6.2 — Navbar Rebuild
**As a** visitor, **I want** a glassmorphism navbar **so that** the platform immediately signals quality and sophistication before reading a word.
**Points**: 5

**Tasks:**
- Rebuild `src/components/layout/navbar.tsx` (full rewrite — keep `withAuth` and auth-state logic):
  - Height 56px, `sticky top-0 z-50`
  - Background: `bg-surface-base/80 backdrop-blur-md border-b border-surface-border`
  - Left: hexagonal SVG logo (create `src/components/shared/Logo.tsx`) + wordmark "AgentHive" in `font-heading font-semibold`
  - Center (desktop only): nav links — Products, Platform, Case Studies — `text-sm text-zinc-400 hover:text-zinc-100 transition-colors`
  - Right: `DemoModeToggle` pill + Log In ghost button + "Get Access" `bg-brand-500` button
  - Mobile: hamburger `Sheet` drawer — full-height, `bg-surface-overlay`, same links + auth buttons
- Logo SVG: single hexagon path, `fill="currentColor" className="text-brand-500"`, 28×28px

**Acceptance Criteria:**
- [ ] Glassmorphism effect visible when scrolled over content (test on hero page)
- [ ] Logo renders as hex SVG, no raster images
- [ ] Mobile drawer opens/closes with no layout shift
- [ ] Nav items active state when on matching route
- [ ] `npm run build` passes with no layout.tsx import errors

---

### Story 6.3 — Homepage Hero Section
**As a** prospect, **I want** a compelling hero section **so that** I immediately understand what AgentHive is and want to try the Product Lab.
**Points**: 5

**Tasks:**
- Rebuild `src/components/landing/hero-section.tsx`:
  - Background: `bg-surface-base` + CSS radial gradient `rgba(51,102,244,0.15)` ellipse behind headline + subtle dot-grid SVG overlay pattern
  - Tag pill: "AI CREDIT INFRASTRUCTURE" — `bg-brand-950 text-brand-300 border border-brand-700 font-mono text-xs uppercase tracking-widest`
  - H1: "Credit Decisioning\nBuilt for Scale." — `text-6xl md:text-7xl font-bold tracking-tight font-heading`, second line gradient text `from-brand-400 to-brand-300` via `bg-clip-text text-transparent`
  - Subheading: `text-lg text-zinc-400 max-w-2xl leading-relaxed`
  - CTAs: "Try Product Lab" (`bg-brand-500 h-11 px-6 rounded-lg`) + "See How It Works" (ghost outline)
  - Trust bar: `text-xs text-zinc-600 font-mono` — SR 11-7, FCRA §615, CFPB guidance
  - Metric ticker strip below: auto-scrolling (`overflow-hidden` + CSS `animation: scroll linear infinite`), pauses on hover
  - Framer Motion: `fadeInDown` on tag pill (delay 0ms), `fadeInUp` on H1 (100ms), subheading (200ms), CTAs (300ms), trust bar (500ms)

**Acceptance Criteria:**
- [ ] Gradient text renders correctly in dark and light modes
- [ ] Metric ticker scrolls smoothly, pauses on hover (`animation-play-state: paused`)
- [ ] CTA "Try Product Lab" links to `/lab`
- [ ] Framer Motion animations fire on page load (not scroll)
- [ ] `prefers-reduced-motion`: all animations disabled, content visible immediately

---

### Story 6.4 — Homepage Product Cards + How It Works
**As a** prospect, **I want** to understand AgentHive's three products clearly **so that** I know which tool is relevant to my role.
**Points**: 5

**Tasks:**
- Rebuild `src/components/landing/products-section.tsx`:
  - Section heading + 3-card grid (`grid-cols-1 md:grid-cols-3 gap-5`)
  - Each card: `bg-surface-raised border border-surface-border rounded-2xl p-6 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300`
  - Icon: 40px `bg-brand-950 rounded-xl p-2` container
  - Bottom link: "Explore →" `text-brand-400 text-sm font-medium`
  - Cards: Underwriting Engine (Scale icon → `/lab/underwriting`), AI Copilot (MessageSquareCode → `/lab/copilot`), Governance Suite (ShieldCheck → `/lab/governance`)
- Create new `src/components/landing/how-it-works-section.tsx`:
  - `bg-surface-raised border-y border-surface-border` background
  - 4-step flow with horizontal dashed connector (desktop), stacked (mobile)
  - Steps: Input → Rules → Inference → Decision (from `CODING_PROMPT.md §8.3`)
  - Each step: numbered circle pill + lucide icon + heading + 1-line description
- Apply `staggerChildren` + `fadeInUp` on scroll (`whileInView`, `once: true`)

**Acceptance Criteria:**
- [ ] All three cards link to correct lab pages
- [ ] Card hover effect visible (border glow + shadow)
- [ ] How-it-works connector line hidden on mobile, visible tablet+
- [ ] Scroll-triggered animations fire once per page load
- [ ] Section renders correctly at 375px (cards stack, no horizontal scroll)

---

### Story 6.5 — Homepage Animated JSON Terminal Preview
**As a** technical prospect, **I want** to see a live decision response format **so that** I understand the API output before trying the lab.
**Points**: 5

**Tasks:**
- Create `src/components/landing/terminal-preview-section.tsx`:
  - Section heading: "See a Decision. In Real Time."
  - Terminal card: `bg-zinc-950 border border-surface-border rounded-2xl overflow-hidden`
  - Top bar: three dot circles (red/yellow/green) + `"POST /api/underwriting/decision"` in `font-mono text-zinc-500 text-xs`
  - JSON content: pre-defined, syntax highlighted via inline `<span>` elements:
    - Keys: `text-blue-400` · Strings: `text-amber-300` · Numbers: `text-emerald-400` · Booleans: `text-violet-400`
  - Framer Motion typewriter: use `useEffect` to reveal JSON character-by-character at 12ms/char on `whileInView`
  - Below: CTA → "Run your own →" linking to `/lab/underwriting`

**Acceptance Criteria:**
- [ ] Typewriter starts only when section scrolls into view
- [ ] No layout shift as characters are revealed (pre-allocated height)
- [ ] Syntax colours match spec
- [ ] `prefers-reduced-motion`: full JSON displayed immediately (no typewriter)
- [ ] CTA button links to `/lab/underwriting`

---

### Story 6.6 — Homepage Case Study Teasers + Compliance Strip + CTA Block
**As a** credibility-seeking visitor, **I want** social proof and trust signals **so that** I convert from browser to demo requester.
**Points**: 5

**Tasks:**
- Rebuild `src/components/landing/about-section.tsx` → rename/repurpose to `case-study-teasers-section.tsx`:
  - 3-card grid, each card: tag chip + title + stat callout (`text-3xl font-bold font-mono text-brand-400`) + 1-line teaser + "Read case study →" link
- Create `src/components/landing/compliance-strip.tsx`:
  - `flex-row flex-wrap gap-8 justify-center py-8`, `border-t border-surface-border`
  - 6 items: each `text-zinc-500 text-xs font-mono` with CheckCircle2 icon
- Rebuild `src/components/landing/contact-section.tsx` → full CTA block:
  - Detached card style: `bg-brand-950 border border-brand-800 rounded-t-3xl mx-4`
  - H2 + body + two CTAs + no-commitment subtext
- Update `src/app/page.tsx` to import all new sections in correct order

**Acceptance Criteria:**
- [ ] All case study teasers link to `/case-studies/[slug]`
- [ ] Compliance strip renders all 6 items without wrapping on 1280px
- [ ] CTA "Book a Demo" button links to `/#contact` or `/contact`
- [ ] Homepage `npm run build` passes with all new imports

---

**Sprint 6 Review Checklist:**
- [ ] Screenshot comparison: homepage resembles Stripe/Mercury aesthetic
- [ ] Metric ticker scrolling on homepage
- [ ] JSON terminal typewriter fires on scroll-into-view
- [ ] All product card links navigate correctly
- [ ] `npm run build` + `npm run lint` both pass

---

---

# SPRINT 7 — Lab UI Rebuild + Governance Dashboard Redesign
**Theme**: Apply the design system to every Lab component and the governance dashboard.
**Duration**: Days 19–22 · **Capacity**: 38 points
**Sprint Goal**: The Lab pages (Underwriting, Copilot, Governance) look and feel like a production fintech tool. Every component matches `CODING_PROMPT.md §8.4–8.6`.

---

### Story 7.1 — Lab Sidebar Rebuild
**As a** lab user, **I want** a polished sidebar **so that** navigation between lab tools is intuitive and the demo mode state is always visible.
**Points**: 3

**Tasks:**
- Fully rebuild `src/app/lab/layout.tsx` sidebar per `CODING_PROMPT.md §8.2`:
  - `bg-surface-raised border-r border-surface-border` — never default background
  - Active: `border-l-2 border-brand-500 bg-brand-950 text-brand-300`
  - Hover: `bg-surface-overlay`
  - All icons: lucide-react, 16px, `strokeWidth=1.5` for consistent weight
  - Demo Mode toggle: amber pill, `bg-review-muted border border-amber-700` when active
  - Bottom: user avatar (initial letter in circle) + email `truncate` + logout
  - Collapsible: 250ms width CSS transition, labels fade with opacity

**Acceptance Criteria:**
- [ ] Active route highlighted with left border + brand background
- [ ] Demo mode toggle amber when active, grey when inactive
- [ ] Collapse/expand smooth at 250ms
- [ ] User email truncated correctly at 200px sidebar width
- [ ] Mobile: sidebar renders as bottom sheet drawer

---

### Story 7.2 — InputPanel Rebuild
**As a** lab user, **I want** a polished input form **so that** entering applicant data feels precise and professional.
**Points**: 5

**Tasks:**
- Rebuild `src/components/lab/InputPanel.tsx` per `CODING_PROMPT.md §8.4`:
  - All field labels: `text-xs font-medium text-zinc-400 uppercase tracking-wide`
  - All inputs: `bg-surface-overlay border border-surface-border rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30`
  - Income: "$" left adornment + comma-formatted string display + income band pill (auto-updates on `onChange` with 150ms crossfade transition)
  - Employment slider: custom tick marks at 0, 5, 10, 20, 30 years below slider track
  - Credit score quality bar: 4px tall, full-width, colour transitions smoothly on input change (CSS transition 300ms)
  - Submit button: `bg-brand-500 hover:bg-brand-600 text-white h-11 w-full rounded-lg font-medium`; loading: `bg-brand-600` + `Loader2 animate-spin`; keyboard hint `"⌘ + Enter"` `text-[10px] text-zinc-600`
  - `useEffect` on mount: field labels `fadeInDown` via Framer Motion

**Acceptance Criteria:**
- [ ] Income band pill colour transitions on every keystroke
- [ ] Credit score quality bar animates (not instant jump)
- [ ] `⌘+Enter` (Mac) submits form (keyboard shortcut wired)
- [ ] Thin-file checkbox visually dims credit score field
- [ ] All focus states visible (ring visible on keyboard navigation)

---

### Story 7.3 — ScenarioSelector Rebuild
**As a** demo operator, **I want** scenario cards that feel interactive **so that** selecting a persona is a satisfying, intentional action.
**Points**: 3

**Tasks:**
- Rebuild `src/components/lab/ScenarioSelector.tsx`:
  - 2×3 grid of scenario cards
  - Unselected: `bg-surface-overlay border border-surface-border`
  - Hover: `border-brand-500/50 bg-surface-overlay`
  - Active/selected: `border-brand-500 bg-brand-950 scale-[1.01] shadow-lg shadow-brand-500/10`
  - Selection triggers: field values animate to new values (number count-up via `useEffect` + `setInterval`, 150ms each field)
  - Label: `text-xs font-medium`; description: `text-[10px] text-zinc-500 truncate`
  - Transition: `transition-all duration-200`

**Acceptance Criteria:**
- [ ] Selected card visually distinct from unselected at a glance
- [ ] Field count-up animation when scenario selected (income, employment_length)
- [ ] Only one card can be active at a time
- [ ] Scenario card selection accessible via keyboard (Enter/Space)
- [ ] Mobile: 3×2 grid (3 columns, 2 rows) fits without horizontal scroll at 375px

---

### Story 7.4 — OutputPanel Rebuild
**As a** user, **I want** a visually impactful decision panel **so that** I understand the approve/reject/review outcome instantly.
**Points**: 5

**Tasks:**
- Rebuild `src/components/lab/OutputPanel.tsx` per `CODING_PROMPT.md §8.4`:
  - Empty state: dashed `border-2 border-dashed border-surface-border` card, `opacity-50` icon, instructional text
  - Skeleton: 3 skeleton cards with `animate-pulse bg-surface-overlay rounded-xl`
  - Decision hero card: `border-l-4` (approve: `border-approve-DEFAULT`, reject: `border-reject-DEFAULT`, review: `border-review-DEFAULT`); gradient background `from-[approve/reject/review-muted]/20 to-transparent`
  - SVG confidence arc (radial progress): SVG circle with `strokeDasharray`/`strokeDashoffset`, animated 0→value over 600ms using Framer Motion `animate`
  - Terms grid: 3 `bg-surface-overlay rounded-xl p-4 text-center` cards
  - Credit limit + APR on reject: `opacity-30 line-through`
  - `scaleIn` animation when result first appears (Framer Motion)
  - `aria-live="polite"` on output container

**Acceptance Criteria:**
- [ ] Correct border and background colour for each decision type
- [ ] Confidence arc animates from 0 to value on every new result
- [ ] `scaleIn` fires once per new decision result (not on re-render)
- [ ] Credit limit + APR struck through and dimmed on reject
- [ ] Screen readers announce decision via `aria-live`
- [ ] Skeleton replaces content area during loading (no spinner overlay)

---

### Story 7.5 — ExplanationPanel Rebuild
**As a** user, **I want** a polished SHAP chart **so that** the factor importance story is immediately obvious.
**Points**: 5

**Tasks:**
- Rebuild `src/components/lab/ExplanationPanel.tsx` per `CODING_PROMPT.md §8.4`:
  - Card: `bg-surface-raised border border-surface-border rounded-2xl p-6`
  - Info `Tooltip` on header
  - `ResponsiveContainer height={260}` → `BarChart layout="vertical"`
  - Positive bars: `fill="#10b981"` · Negative: `fill="#ef4444"`
  - `ReferenceLine x={0}` dashed zinc-700
  - Custom `YAxisTick`: `font-mono text-xs text-zinc-400` — human-readable labels
  - Custom `Tooltip`: `"Annual Income: +0.42 — strong positive signal"` black card bg-zinc-800
  - Inline end-labels on bars: `±X.XX` in `font-mono text-xs`
  - Below chart: two-column factor summary grid (positive / negative columns, 4px magnitude bars)
  - `role="img"` `aria-label="Decision factor importance chart showing 5 features"`

**Acceptance Criteria:**
- [ ] All bars sorted by absolute value (largest at top)
- [ ] Positive/negative colour correct for all 7 features
- [ ] Custom tooltip shows human-readable label and qualifier text
- [ ] `aria-label` describes the chart for screen readers
- [ ] Chart renders at 320px viewport (minimum — test in DevTools)

---

### Story 7.6 — Governance KPI Strip + Overview Charts
**As a** risk manager, **I want** a polished governance overview **so that** I can assess portfolio health at a glance.
**Points**: 5

**Tasks:**
- Rebuild `/lab/governance` overview tab per `CODING_PROMPT.md §8.6`:
  - 4 KPI cards (`h-28`, `grid-cols-2 md:grid-cols-4`):
    - Large number: `text-3xl font-bold font-mono tabular-nums`
    - Trend indicator: arrow + % vs prior period
    - Sparkline: `<LineChart>` in `<ResponsiveContainer width={80} height={32}>` — no axes, no tooltip, line only
  - Approval Rate by Segment: `BarChart` horizontal grouped bars
  - Rules Triggered Frequency: `BarChart` vertical bars, fill `bg-brand-500`
  - Decision Volume Over Time: `AreaChart` 30-day, fill `bg-brand-500/20`, stroke `text-brand-400`

**Acceptance Criteria:**
- [ ] KPI numbers use `tabular-nums` — no layout shift between values
- [ ] Sparklines render without axes (just the line)
- [ ] Period selector (`Select`) triggers API re-fetch and updates all 4 KPIs + charts
- [ ] Charts animate on first load (`animationDuration=700`)

---

### Story 7.7 — Decision History Table + Sheet Drawer
**As a** auditor, **I want** a paginated decision table **so that** I can drill into any past decision and see its full audit trail.
**Points**: 5

**Tasks:**
- Rebuild `src/components/governance/DecisionHistoryTable.tsx` per `CODING_PROMPT.md §8.6`:
  - Even row striping: `bg-surface-overlay`
  - Time: `formatDistanceToNow()` (e.g. "2 min ago") with title tooltip showing ISO timestamp
  - Decision cell: `<DecisionBadge>` inline
  - Amount cells: `font-mono`
  - Filter bar: Decision `Select` + Segment `Select` + `Input` search by decision_id fragment
  - Pagination footer: `font-mono text-xs text-zinc-500 "Showing 1–10 of 1,247"` + prev/next buttons
  - "View" button → shadcn/ui `Sheet` (`side="right" className="w-[520px]"`):
    - Sheet content: full decision JSON in `bg-zinc-950 rounded-xl` syntax-highlighted block
    - Copy JSON button at top of sheet

**Acceptance Criteria:**
- [ ] Pagination correctly offsets API calls
- [ ] Search by partial decision_id filters results
- [ ] Sheet opens and shows complete decision JSON
- [ ] Clicking outside sheet closes it; focus returns to trigger button
- [ ] Table renders 100 rows without performance degradation

---

**Sprint 7 Review Checklist:**
- [ ] All 6 scenario presets render correctly through the rebuilt InputPanel
- [ ] Confidence arc animates on every new decision
- [ ] Governance dashboard KPIs load from live API
- [ ] Decision history table Sheet shows accurate full JSON
- [ ] `npm run build` passes

---

---

# SPRINT 8 — Auth UI + Case Studies + Micro-Interactions + Accessibility
**Theme**: Final polish. Auth pages, case studies, micro-interactions, responsive audit, and WCAG AA sign-off.
**Duration**: Days 23–25 · **Capacity**: 28 points
**Sprint Goal**: Every page of the platform passes the UI Litmus Test in `CODING_PROMPT.md §14`. A CRO can complete the full demo journey without friction on any device.

---

### Story 8.1 — Login + Signup Auth UI Rebuild
**As a** first-time visitor, **I want** a fintech-quality auth experience **so that** my first impression of AgentHive's craftsmanship begins before the platform loads.
**Points**: 5

**Tasks:**
- Rebuild `src/app/login/page.tsx` per `CODING_PROMPT.md §8.10`:
  - Split-screen layout: `grid-cols-1 lg:grid-cols-2 min-h-screen`
  - Left panel (`hidden lg:flex bg-surface-raised border-r border-surface-border`):
    - Logo, quote, 3-bullet trust list (CheckCircle2 icons)
    - Compact JSON terminal preview card at bottom (static, not animated)
  - Right panel: `bg-surface-base` with form centered `max-w-sm mx-auto`
    - "Continue with Google" full-width ghost button (Firebase `signInWithPopup`)
    - "or" divider
    - Email + Password fields (show/hide password eye toggle)
    - Forgot password link right-aligned
    - Submit: `bg-brand-500 h-11 w-full`
    - Footer: "Don't have an account? Get access →"
- Rebuild `src/app/signup/page.tsx`: same layout, different copy
- Rebuild `src/app/forgot-password/page.tsx`: right-panel only (no left panel), email field + back link

**Acceptance Criteria:**
- [ ] Left panel hidden on mobile (`hidden lg:flex`)
- [ ] Google sign-in works (Firebase popup)
- [ ] Password show/hide toggle functional
- [ ] "Forgot password?" links to `/forgot-password`
- [ ] Forgot password sends Firebase reset email (existing logic retained)
- [ ] All form validation uses existing Zod schemas (not rewritten)

---

### Story 8.2 — Case Studies Pages
**As a** prospect, **I want** case study pages **so that** I can understand the real-world impact of AgentHive's systems.
**Points**: 5

**Tasks:**
- Create `src/app/case-studies/page.tsx` — index per `CODING_PROMPT.md §8.7`:
  - Hero H1 + 3-card grid
  - Each card: `bg-surface-raised rounded-2xl overflow-hidden` + 4px top accent band
  - Tag chips, title, key metric (`text-4xl font-bold font-mono text-brand-400`), teaser, footer
- Create `src/app/case-studies/[slug]/page.tsx` — static params for 3 slugs:
  - Data from `CASE_STUDIES` array in `src/lib/case-studies.ts`
  - Hero: tag chips + H1 + 3 metric pills
  - Each section: `border-l-2 border-surface-border pl-5` (Problem, Approach, Model Design, Impact)
  - Impact table: `bg-surface-raised rounded-xl border border-surface-border`, result values `font-mono font-bold text-brand-300`
  - Bottom CTA card: "Want this outcome? Book a Technical Demo"
- Create `src/lib/case-studies.ts` with `CASE_STUDIES` array per `CODING_PROMPT.md §5.7`

**Acceptance Criteria:**
- [ ] `/case-studies` renders all 3 cards with correct metric stats
- [ ] Each slug renders the correct case study data
- [ ] All slugs resolvable at build time (`generateStaticParams`)
- [ ] "Book a Technical Demo" CTA links to contact section
- [ ] Impact table result values in correct brand colour

---

### Story 8.3 — Micro-Interactions
**As a** user, **I want** polished micro-interactions **so that** every action feels responsive and intentional.
**Points**: 5

**Tasks:**
- Implement all 10 micro-interactions from `CODING_PROMPT.md §8.9`:
  1. **Copy decision_id**: `useClipboard` hook — icon morphs `Clipboard → Check` (150ms), toast "Decision ID copied" 2s auto-dismiss
  2. **Scenario card select**: unselected cards `opacity-80 scale-[0.99]`; selected `scale-[1.01] shadow-brand-500/10`
  3. **Income field**: band pill colour crossfade (150ms CSS transition)
  4. **Credit score field**: quality bar colour + width CSS transition 300ms
  5. **Submit button hover**: `scale(1.01)` + `brightness(1.05)` (CSS)
  6. **Decision arriving**: OutputPanel `scaleIn` from Framer Motion (already in 7.4 — verify)
  7. **Governance tab switch**: content `opacity-0 → opacity-100` 150ms Framer
  8. **Confidence arc**: SVG `strokeDashoffset` Framer animate 0→value 600ms
  9. **Sidebar collapse**: `width` CSS transition 250ms; labels `opacity` 150ms
  10. **Demo mode toggle**: amber banner `height` Framer animate (0 → 36px) 300ms ease-out
- All transitions respect `prefers-reduced-motion` (`shouldReduceMotion()` check)

**Acceptance Criteria:**
- [ ] All 10 interactions implemented and reviewable in browser
- [ ] Copy toast appears within 100ms and dismisses at 2s
- [ ] Demo mode banner slides in (not instant-appearing)
- [ ] `prefers-reduced-motion`: all 10 interactions either instant or no animation

---

### Story 8.4 — Responsive Audit (All Pages)
**As a** mobile user, **I want** the platform to work at any screen size **so that** I can demo it on a phone or tablet during a meeting.
**Points**: 5

**Tasks:**
- Test every page at: 375px, 390px, 768px, 1024px, 1280px, 1536px
- Fix all issues found:
  - Lab page at 375px: input + output panels in tab switcher (`Tabs` component), not stacked scroll
  - Sidebar at 768px: `Sheet` drawer triggered by hamburger in lab breadcrumb bar
  - All charts at 320px: `ResponsiveContainer` with `min-width: 280px`, labels not clipped
  - Governance table at 768px: horizontal scroll with `overflow-x-auto`, never truncates data
  - Navbar at 375px: logo + hamburger only; no nav links showing
  - Homepage metric ticker: no horizontal overflow (CSS `overflow: hidden` on container)
  - Decision badge: full-width on 375px (`w-full` class)
- Use Chrome DevTools device simulation for all breakpoints

**Acceptance Criteria:**
- [ ] No horizontal scrollbar on any page at 375px
- [ ] No text smaller than 11px on mobile (WCAG AA minimum)
- [ ] Lab tabs switch between Input/Output correctly at 375px
- [ ] All charts readable at 320px (no label bleed outside card)
- [ ] Governance table accessible on 768px (horizontal scroll with visible scrollbar)

---

### Story 8.5 — Accessibility (WCAG AA Sign-off)
**As a** user with accessibility needs, **I want** the platform to be fully navigable **so that** I am not excluded from using the decisioning tools.
**Points**: 5

**Tasks:**
- Audit and fix all pages for WCAG AA:
  - **Focus rings**: every interactive element — `focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base`
  - **Colour contrast**: run Chrome DevTools Accessibility Panel on all text/background pairs — remediate any pairs failing 4.5:1
  - **Icons**: all decorative Lucide icons: `aria-hidden="true"`; standalone interactive icons (copy, close): `aria-label="Copy decision ID"`
  - **Form labels**: every `<input>` has a paired `<label>` (not placeholder-only)
  - **Charts**: `role="img"` + `aria-label` on all `<ResponsiveContainer>` wrappers
  - **Decision output**: `aria-live="polite"` on OutputPanel container (already in 7.4 — verify)
  - **Modal/Sheet**: focus trap confirmed (`Tab` cycles inside); `Escape` closes; focus returns to trigger
  - **Loading states**: `aria-busy="true"` on OutputPanel during fetch
- Run `axe` browser extension audit on Homepage, Underwriting, Governance, Login — zero critical/serious violations

**Acceptance Criteria:**
- [ ] Entire `/lab/underwriting` page navigatable by keyboard only (Tab + Enter + Space + Escape)
- [ ] `axe` audit: 0 critical violations on Homepage and Underwriting page
- [ ] All form fields have explicit `<label>` elements
- [ ] All charts have descriptive `aria-label`
- [ ] Decision output announced by VoiceOver/NVDA on result

---

### Story 8.6 — AuditPanel Rebuild + Demo Mode Banner
**As a** compliance officer, **I want** a polished audit trail panel **so that** every decision's provenance is clear in a single readable view.
**Points**: 3

**Tasks:**
- Finalize `src/components/lab/AuditPanel.tsx` terminal aesthetic:
  - `bg-zinc-950` container with mono font grid layout (columns aligned)
  - `demo_mode: true` value: `text-amber-400`
  - Hash value: truncated to 16 chars + "…" with full hash in `Tooltip`
- Demo Mode amber banner (`src/components/lab/DemoModeToggle.tsx`):
  - Framer `motion.div` animate height `0 → 36px` when demo mode activated
  - Content: `bg-review-muted border-b border-amber-700 text-amber-300 text-xs font-mono`
  - Text: "Demo Mode Active — Responses are illustrative. Not live inference."

**Acceptance Criteria:**
- [ ] Audit terminal renders all 8 fields with correct mono alignment
- [ ] Demo mode banner slides in (height animation, not instant)
- [ ] Hash truncated to 16 chars in panel, full hash shown in tooltip
- [ ] `demo_mode: true` value in amber, `false` in zinc-500

---

**Sprint 8 Review Checklist:**
- [ ] Login page split-screen at 1280px, single column at 375px
- [ ] All 3 case study pages render with correct data
- [ ] Demo mode banner slides in smoothly
- [ ] Copy toast fires and auto-dismisses
- [ ] `axe` audit: 0 critical violations
- [ ] Keyboard navigation: full journey `/lab/underwriting` tab-navigatable
- [ ] All breakpoints tested: 375 / 768 / 1024 / 1280 / 1536
- [ ] `npm run build` passes clean
- [ ] UI Litmus Test (`CODING_PROMPT.md §14`) answers: all "yes"

---

---

## 📋 SPRINT TRACKING SUMMARY

| Sprint | Theme | Status | Start | End | Points |
|---|---|---|---|---|---|
| Sprint 1 | Backend Scaffold + Rules Engine | ⬜ Not Started | Day 1 | Day 3 | 28 |
| Sprint 2 | Typed API Client + Basic Lab UI | ⬜ Not Started | Day 4 | Day 5 | 22 |
| Sprint 3 | ML Intelligence + SHAP + Copilot | ⬜ Not Started | Day 6 | Day 9 | 34 |
| Sprint 4 | Governance APIs + Genkit LLM Flow | ⬜ Not Started | Day 10 | Day 12 | 30 |
| Sprint 5 | Backend Hardening + Tests + Docker | ⬜ Not Started | Day 13 | Day 14 | 20 |
| Sprint 6 | Design System + Navbar + Homepage | ⬜ Not Started | Day 15 | Day 18 | 36 |
| Sprint 7 | Lab UI Rebuild + Governance UI | ⬜ Not Started | Day 19 | Day 22 | 38 |
| Sprint 8 | Auth + Case Studies + Polish + A11y | ⬜ Not Started | Day 23 | Day 25 | 28 |

**Status legend**: ⬜ Not Started · 🔵 In Progress · ✅ Done · 🔴 Blocked

---

## 🔗 REFERENCE DOCUMENTS

| Document | Purpose |
|---|---|
| [CODING_PROMPT.md](./CODING_PROMPT.md) | Full technical specification, API contracts, UI specs, design tokens |
| [PRD.md](./PRD.md) | Product requirements, personas, feature definitions |
| [blueprint.md](./blueprint.md) | System architecture overview |
