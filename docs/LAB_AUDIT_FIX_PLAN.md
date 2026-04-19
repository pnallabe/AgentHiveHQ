# Product Lab — Audit Fix Implementation Plan

Generated: 2026-04-19  
Source audit: `docs/LAB_AUDIT_RESULTS.md`

Each prompt below is a self-contained coding instruction. Apply them in order — later prompts may depend on earlier ones (dependencies are noted).

---

## Phase 1 — Critical: Server-Side Authentication (C-1)

### Prompt 1 — Add Firebase token verification dependency to FastAPI

```
In `backend/app/core/dependencies.py`, create an async FastAPI dependency
called `require_firebase_user` that:

1. Reads the `Authorization: Bearer <token>` header from the incoming request.
2. If the header is absent or malformed, raises `HTTPException(status_code=401,
   detail="Missing or invalid Authorization header")`.
3. Calls `firebase_admin.auth.verify_id_token(token)` (the `firebase_admin` SDK
   is already initialised in `app/core/firebase_admin.py`).
4. If verification fails (any `firebase_admin.auth` exception), raises
   `HTTPException(status_code=401, detail="Invalid or expired Firebase token")`.
5. Returns the decoded token dict so downstream routes can access `uid`,
   `email`, etc.

Wrap the synchronous `verify_id_token` call with `asyncio.to_thread` so it
does not block the event loop.
```

---

### Prompt 2 — Protect underwriting routes

```
In `backend/app/modules/underwriting/api.py`:

1. Import `require_firebase_user` from `app.core.dependencies`.
2. Add `_user: dict = Depends(require_firebase_user)` to both
   `create_decision` and `get_history` function signatures.
3. Do not change any other logic — the dependency only needs to be present to
   enforce auth; the user dict does not need to be used yet.
4. Update the docstring of the router to note that both endpoints require a
   valid Firebase ID token.
```

---

### Prompt 3 — Protect governance routes

```
In `backend/app/modules/governance/api.py`:

Apply the same pattern as Prompt 2:
1. Import `require_firebase_user` from `app.core.dependencies`.
2. Add `_user: dict = Depends(require_firebase_user)` to both
   `governance_dashboard` and `bias_report` function signatures.
```

---

### Prompt 4 — Protect copilot and integrations routes

```
1. In `backend/app/modules/copilot/api.py`, import `require_firebase_user`
   and add `_user: dict = Depends(require_firebase_user)` to `explain_decision`.

2. In `backend/integrations/router.py`, import `require_firebase_user` from
   `app.core.dependencies` and add it as a dependency to these four endpoints:
   - `list_products` (GET /api/integrations)
   - `get_product`   (GET /api/integrations/{product_id})
   - `get_schema`    (GET /api/integrations/{product_id}/schema)
   - `invoke_product` (POST /api/integrations/{product_id}/invoke)

   Do NOT add it to the admin POST /api/integrations (register) or DELETE
   endpoints — those are internal/CI use only for now.
```

---

## Phase 2 — High: Environment & API Client Hardening (C-2, C-3, C-4)

### Prompt 5 — Fail fast on missing `NEXT_PUBLIC_API_URL`

```
In `src/lib/api.ts`:

1. Replace the current silent default:
     const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
   with a check that throws during module initialisation if the variable is
   absent AND we are running in a production build:

     const _raw = process.env.NEXT_PUBLIC_API_URL;
     if (!_raw && process.env.NODE_ENV === "production") {
       throw new Error(
         "[api] NEXT_PUBLIC_API_URL is not set. Add it to your environment before building."
       );
     }
     const BASE_URL = _raw ?? "http://localhost:8000";

2. Add a JSDoc comment above BASE_URL explaining the env var requirement.
```

---

### Prompt 6 — Surface `getIdToken` failures instead of swallowing them

```
In `src/lib/api.ts`, update `getIdToken()`:

1. Remove the try/catch that returns `null` on every error.
2. Only return `null` (graceful) when `auth.currentUser` is null (user not
   signed in). This is an expected case.
3. For all other errors (token refresh failure, network error, etc.) rethrow
   the error so `apiFetch` catches it and converts it to an `ApiError` with
   status 0 and a message like:
     "Failed to obtain auth token: <err.message>"
   This surfaces the problem to the UI instead of silently sending an
   unauthenticated request.
```

---

### Prompt 7 — Guard `auth.signOut()` against SSR context

```
In `src/lib/api.ts`, inside the 401 handling block of `apiFetch`:

Replace:
  await auth.signOut();
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }

With:
  if (typeof window !== "undefined") {
    // Client-only: sign out and redirect
    try { await auth.signOut(); } catch { /* ignore */ }
    window.location.replace("/login");
  }

This ensures `auth.signOut()` (a Firebase Client SDK call) is never invoked
during SSR, which would throw because the Firebase app is client-only.
```

---

## Phase 3 — High: Copilot Route (C-P-1, C-P-2, C-P-4)

### Prompt 8 — Remove dead `apiClient.copilot` namespace or wire it up

```
In `src/lib/api.ts`, the `copilot.explain()` method calls
`POST /api/copilot/explain` but is never used by the UI (the Genkit server
action is called directly instead). Do one of the following — choose option A:

Option A (remove dead code):
  Remove the `copilot` key from the `apiClient` object entirely.
  Remove the `CopilotRequest` and `CopilotResponse` type imports in api.ts
  that are only used by this dead method.
  Update `src/lib/types.ts` to mark `CopilotRequest` as unused (add a comment)
  but do not delete it yet — the server action still uses a compatible shape.

Option B (wire it up — only if the FastAPI copilot endpoint is preferred):
  In `src/app/lab/copilot/page.tsx`, replace the `getCreditCopilotNarrative()`
  server action call with `apiClient.copilot.explain({ decision_response: result, ... })`.
  Remove the import of `getCreditCopilotNarrative`.
```

---

### Prompt 9 — Handle missing Genkit API key gracefully

```
In `src/ai/flows/credit-copilot-flow.ts` (or whichever file bootstraps the
Genkit `ai` instance in `src/ai/genkit.ts`):

1. At module initialisation time, check for the required API key env var
   (e.g. `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY`).
2. If absent, export a flag `IS_GENKIT_CONFIGURED = false`.

In `src/app/lab/copilot/page.tsx`:

3. Import `IS_GENKIT_CONFIGURED` from `@/ai/genkit`.
4. If `!IS_GENKIT_CONFIGURED`, set `copilotError` to a user-readable message
   ("AI narrative generation is not available in this environment — API key not
   configured.") without attempting to call `getCreditCopilotNarrative()`.
5. Show this error in the `CopilotNarrative` error slot before the user even
   submits a form, so it is clearly a configuration problem not a submission
   error.
```

---

### Prompt 10 — Prevent concurrent Genkit invocations

```
In `src/app/lab/copilot/page.tsx`:

1. Add a `useRef<AbortController | null>(null)` named `copilotAbortRef`.
2. At the start of the Genkit call section (Step 2), abort any in-progress
   call: `copilotAbortRef.current?.abort()`.
3. Create a new `AbortController` and store it in the ref.
4. Pass the signal into `getCreditCopilotNarrative` — update the function
   signature to accept `{ signal?: AbortSignal }` and honour it if supported
   by the Genkit SDK; if not, at minimum check `signal.aborted` before calling
   `setCopilotResponse(...)` in the `.then()` handler, and skip the state
   update if the request was superseded.
5. In the `finally` block, clear `copilotAbortRef.current = null`.
```

---

## Phase 4 — High: Integrations Page Error Handling (I-1, I-2, I-3)

### Prompt 11 — Show inline error banner when product list fails to load

```
In `src/app/lab/integrations/page.tsx`:

1. Add state: `const [listError, setListError] = useState<string | null>(null);`
2. In the `catch` block of `loadProducts`, in addition to showing the toast,
   call `setListError((err as Error).message ?? "Failed to load integrations.")`.
3. In the `try` block, clear it: `setListError(null)`.
4. Render the error below the header, similar to the pattern in
   `src/app/lab/governance/page.tsx`:
     {listError && (
       <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-4 text-sm text-reject-base">
         {listError}
       </div>
     )}
```

---

### Prompt 12 — Replace `alert()` with inline validation in `DynamicInputForm`

```
In `src/app/lab/integrations/page.tsx` inside the `DynamicInputForm` component:

1. Add state: `const [jsonError, setJsonError] = useState<string | null>(null);`
2. In `handleSubmit`, replace the `alert("Invalid JSON in inputs")` call with:
     setJsonError("Invalid JSON — please check your input and try again.");
     return;
3. On a successful parse, call `setJsonError(null)` before calling `onInvoke`.
4. Render the error message inline, just above the submit button:
     {jsonError && (
       <p className="text-xs text-red-400" role="alert">{jsonError}</p>
     )}
```

---

### Prompt 13 — Fetch and render the upstream OpenAPI schema

```
In `src/app/lab/integrations/page.tsx`:

1. In `IntegrationsLabPage`, add state:
     const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
     const [schemaLoading, setSchemaLoading] = useState(false);

2. When `selectedId` changes (useEffect on `[selectedId]`), call
   `apiClient.integrations.schema(selectedId)`. On success store in `schema`.
   Show a loading skeleton while fetching. On error, keep `schema = null`
   (graceful degrades to the current raw JSON editor).

3. Pass `schema` into `DynamicInputForm` as a prop.

4. Inside `DynamicInputForm`, if `schema` is available and the
   `!useRaw` branch is active, render a labelled input field for each property
   defined in `schema.properties` (from the OpenAPI JSON Schema object).
   Each field should show the property name, type annotation, and description
   as a tooltip/sublabel.

5. Collect the field values and pass them as `inputs` to `onInvoke`.
```

---

## Phase 5 — Medium: Race Conditions & Stale State (G-1, I-4, C-P-4)

### Prompt 14 — Cancel stale governance dashboard requests

```
In `src/app/lab/governance/page.tsx`:

1. Change `load` to accept an `AbortSignal`:
     const load = useCallback(async (signal?: AbortSignal) => { ... }, [period]);

2. Pass the signal to `apiFetch` — this requires adding an optional `signal`
   parameter to `apiFetch` in `src/lib/api.ts`, merging it into the `fetch`
   options:
     signal: options.signal ?? controller.signal
   (the existing AbortController timeout should still apply if no external
   signal is given).

3. In the `useEffect` that calls `load()`:
     useEffect(() => {
       const controller = new AbortController();
       load(controller.signal);
       return () => controller.abort();
     }, [load]);

4. In the catch block of `load`, ignore `AbortError` (stale request cancelled
   by a subsequent period change) rather than setting the error state.
```

---

### Prompt 15 — Fix stale selected-product state after list refresh

```
In `src/app/lab/integrations/page.tsx`, in `loadProducts()` after the list is
fetched:

After `setProducts(list)`:
1. Check if the currently selected product still exists in the new list:
     const stillExists = list.some((p) => p.product_id === selectedId);
2. If it no longer exists, call:
     setSelectedId(list.length > 0 ? list[0].product_id : null);
     setResult(null);
     setError(null);
This prevents an orphaned `selectedId` from keeping a stale invoke panel
visible after the product has been removed from the registry.
```

---

## Phase 6 — Medium: Governance Silent Failures & Stale Sparklines (G-2, G-3)

### Prompt 16 — Replace hardcoded sparklines with real trend data

```
In `backend/app/modules/governance/service.py`, update `GovernanceDashboardService.get()`
to include a `trend` key in the response dict. The trend should be a list of
{ "date": "YYYY-MM-DD", "approvals": int, "rejections": int } objects grouped
by day for the requested period. Query `DecisionRecord` grouped by
`DATE(created_at)`.

In `src/lib/types.ts`, add `trend: { date: string; approvals: number; rejections: number }[]`
to the `GovernanceDashboard` interface.

In `src/app/lab/governance/page.tsx`:
- Pass `data.trend` as `sparkData` to the "Approval Rate" KpiCard, mapping
  each entry to `{ v: approvals / (approvals + rejections) * 100 }`.
- Pass `data.trend` as `sparkData` to the "Total Decisions" KpiCard, mapping
  to `{ v: approvals + rejections }`.
- Remove the hardcoded sparkData arrays from the other two KpiCards (Avg Credit
  Limit and Avg APR) and omit the `sparkData` prop entirely — these do not
  have a meaningful daily trend yet.
```

---

### Prompt 17 — Surface errors from `BiasIndicatorChart` and `FeatureImportanceChart`

```
In each of `src/components/governance/BiasIndicatorChart.tsx` and
`src/components/governance/FeatureImportanceChart.tsx`:

1. Add local error state: `const [error, setError] = useState<string | null>(null);`
2. In the data-fetching `useEffect`, set `setError(err.message)` in the catch.
3. If `error` is set, render an inline error card:
     <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-3 text-xs text-reject-base">
       Failed to load: {error}
     </div>
   instead of rendering nothing/a blank panel.
4. Export a `hasError: boolean` prop from each component so the parent
   `Tabs` in `governance/page.tsx` can optionally badge the tab trigger with
   a warning icon when either chart is in error state.
```

---

## Phase 7 — Low: UX Polish (C-5, U-1, U-2)

### Prompt 18 — Fix breadcrumb for Integration Gateway

```
In `src/app/lab/LabShell.tsx`, inside the `SEGMENT_LABELS` record inside the
`Breadcrumb()` function, add the missing mapping:

  integrations: "Integration Gateway",

The record should now read:
  const SEGMENT_LABELS: Record<string, string> = {
    underwriting:  "Underwriting Engine",
    copilot:       "AI Copilot",
    governance:    "Governance Suite",
    integrations:  "Integration Gateway",
  };
```

---

### Prompt 19 — Sync model version badge from API response

```
In `src/app/lab/underwriting/page.tsx`:

1. Remove the hardcoded `const MODEL_VERSION = "v1.0.0";` constant.
2. Derive the displayed version from the API result:
     const modelVersion =
       outputState.status === "result"
         ? outputState.result.audit.model_version
         : null;
3. Replace every usage of `MODEL_VERSION` in the JSX with `modelVersion`.
4. When `modelVersion` is null (idle or loading state), render a skeleton or
   em-dash placeholder instead of the badge so the UI doesn't flash stale data.
```

---

### Prompt 20 — Add client-side form validation to `InputPanel`

```
In `src/components/lab/InputPanel.tsx`:

1. Before calling `onSubmit(payload)`, validate that all required numeric
   fields are non-empty and within plausible ranges:
   - `annual_income` > 0
   - `loan_amount` > 0
   - `credit_score` between 300 and 850
   - `employment_months` >= 0

2. For any failing field, set an inline error message next to that field using
   a small `<p className="text-xs text-red-400 mt-1">{fieldError}</p>` block.

3. Prevent the form from submitting if any validation errors are present.

4. Clear field-level errors when the user edits that field.
```

---

## Execution order & dependencies

```
Prompt 1  → Prompt 2, 3, 4 (auth dependency must exist first)
Prompt 5  → Prompt 6, 7    (api.ts changes should be batched)
Prompt 6  → Prompt 14      (apiFetch signal param added in 14 needs 6 applied first)
Prompt 8  → standalone
Prompt 9  → Prompt 10      (need genkit config flag before abort guard)
Prompt 11 → Prompt 12, 13  (integrations page state changes — do in one pass)
Prompt 14 → standalone after Prompt 5-7
Prompt 15 → standalone
Prompt 16 → needs backend service change before frontend types update
Prompt 17 → standalone
Prompt 18 → standalone (one-liner)
Prompt 19 → standalone
Prompt 20 → standalone
```

---

## Acceptance criteria (per issue)

| Issue | Passing condition |
|---|---|
| C-1 | Unauthenticated `curl POST /api/underwriting/decision` returns HTTP 401 |
| C-2 | `npm run build` fails with a clear error when `NEXT_PUBLIC_API_URL` is unset in production mode |
| C-3 | A token-refresh failure shows an error in the UI instead of silently sending no auth header |
| C-4 | Next.js build with `output: "standalone"` produces no Firebase SDK SSR errors |
| C-5 | Navigating to `/lab/integrations` shows "Integration Gateway" in the breadcrumb |
| C-P-1 | `/api/copilot/explain` endpoint either wired to UI or dead code removed |
| C-P-2 | Missing Genkit API key shows a user-readable banner before form submission |
| C-P-4 | Rapid double-submit does not produce two concurrent copilot state updates |
| G-1 | Rapidly switching governance period twice only applies the last response |
| G-2 | Governance sparklines reflect real trend data from the API |
| G-3 | Bias / Feature Importance chart failures show an error message in their panel |
| G-4 | Tab-level errors are visible within the relevant tab |
| I-1 | Failed integrations list load shows an inline error banner |
| I-2 | Invalid JSON in integrations form shows inline error, no `alert()` |
| I-3 | Selecting a product fetches and renders its OpenAPI schema as a form |
| I-4 | Refreshing integrations list when selected product is removed resets selection |
| I-5 | (Out of scope for this plan — consider a future health polling story) |
| U-1 | Underwriting page badge shows version from `result.audit.model_version` |
| U-2 | Submitting empty underwriting form shows inline field-level errors |
