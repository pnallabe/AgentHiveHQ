# Outreach Engine — Operating Manual

**Purpose:** founder-led outbound to Heads of Model Risk / CROs at mid-market
fintech lenders ($100M–$5B AUM), aligned with the governance-first positioning
in `docs/PMF_ANALYSIS_AND_REBRANDING.md`.

**The on-brand principle:** we sell governance, so the outreach is governed.
Every touch is an append-only `outreach_messages` row, every send checks the
suppression list first, and every email carries an RFC 8058 one-click
unsubscribe. Nothing is ever deleted.

---

## Architecture

```
prospects (CSV import) ──► enrollments (exam-ready-v1) ──► sequencer (daily)
                                                              │
              ┌───────────────────────────────────────────────┤
              ▼                                               ▼
     suppression gate                                  rate-limit gate
     (email + domain)                                  (20/day default)
              │                                               │
              └──────────────► SMTP send ◄────────────────────┘
                               (founder inbox Reply-To)
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
     /u/{token} unsubscribe     /t/{id}.gif open pixel     /c/{id} click redirect
```

## The sequence: `exam-ready-v1`

| Touch | Day | Goal | CTA |
|---|---|---|---|
| 1 | 0 | SR 11-7 documentation pain ("6-week scramble → minutes") | Reply "send it" for sample audit package |
| 2 | 4 | Proof artifact + "you own the model" counter-position | 15-min call / sample package link |
| 3 | 9 | Breakup — respect the inbox | One-word reply ("later" is fine) |

Copy lives in `backend/app/modules/outreach/templates.py`. Edit there; the
sequencer picks up changes on the next run (no migration needed).

## Operating the pipeline

All admin calls need the header `X-Outreach-Admin-Key: $OUTREACH_ADMIN_KEY`
against `https://agenthivehq-backend-api-311931689095.us-central1.run.app/api/v1/outreach`.

### 1. Enrich the prospect list

`backend/data/outreach/midmarket_fintech_prospects.csv` ships with ~55
mid-market fintech lenders (company, domain, segment, AUM band, research
notes). **Contact columns are intentionally empty** — enrich with Apollo,
Clay, or LinkedIn Sales Navigator, targeting: *Head of Model Risk, CRO,
VP Risk, Chief Credit Officer*. One contact per company to start.

### 2. Import

```bash
curl -X POST "$BASE/admin/prospects/import" \
  -H "X-Outreach-Admin-Key: $KEY" \
  -F "file=@backend/data/outreach/midmarket_fintech_prospects.csv"
```

Idempotent: duplicates and suppressed addresses are skipped, incomplete rows
are reported in `errors`.

### 3. Enroll

```bash
IDS=$(curl -s "$BASE/admin/prospects?status=new" -H "X-Outreach-Admin-Key: $KEY" | jq -r '.[].id' | jq -R . | jq -cs .)
curl -X POST "$BASE/admin/enroll" -H "X-Outreach-Admin-Key: $KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"prospect_ids\": $IDS, \"sequence\": \"exam-ready-v1\"}"
```

### 4. Dry-run first

`OUTREACH_SEND_ENABLED` defaults to `false`. Run the sequencer and inspect
the rendered subjects/bodies in `outreach_messages` (status `queued`):

```bash
curl -X POST "$BASE/admin/run-sequencer" -H "X-Outreach-Admin-Key: $KEY"
```

### 5. Go live

Set `OUTREACH_SEND_ENABLED=true` in `cloudbuild-backend.yaml` and redeploy.
Keep `OUTREACH_DAILY_LIMIT=20` for the first two weeks (Gmail workspace
warmup), then raise gradually toward 50.

### 6. Watch the funnel

```bash
curl -s "$BASE/admin/stats" -H "X-Outreach-Admin-Key: $KEY" | jq
```

Replies land in the founder inbox (Reply-To). When a prospect replies, mark
them: update `outreach_prospects.status = 'replied'` and stop the enrollment
(via SQL or a future admin endpoint) so touch 2/3 don't fire.

## Compliance checklist (already enforced by code)

- [x] One-click unsubscribe (GET + POST, RFC 8058) on every email
- [x] `List-Unsubscribe` + `List-Unsubscribe-Post` headers (Gmail bulk-sender rule)
- [x] Suppression list checked before every send (email AND domain)
- [x] Append-only message log — every send, suppression, and dry-run recorded
- [x] Daily send cap
- [ ] Physical mailing address in the footer — add to `_FOOTER` in
      `templates.py` before first live send (CAN-SPAM requirement)

## Email authentication (SPF / DKIM / DMARC) — verified 2026-11-26

**Current state: outreach sends as `@gmail.com`, not `@agenthivehq.com`.**
`SMTP_USERNAME=pradeep.nallabelli@gmail.com` and `OUTREACH_FROM_EMAIL` is
blank, so every email goes out From a free gmail.com address.

| Check | Sending identity (`gmail.com`) | Status |
|---|---|---|
| SPF | `v=spf1 redirect=_spf.google.com` | ✅ Google-managed, covers you |
| DKIM | Google signs all gmail.com mail | ✅ Automatic |
| DMARC | `v=DMARC1; p=none` | ✅ Passes (Google-managed) |

**For the current gmail.com setup, authentication is fully handled by Google —
nothing to fix.** Deliverability is as good as free Gmail gets, and the 20/day
warmup cap is well under Gmail's ~500/day free-tier limit.

### `agenthivehq.com` DNS (verified 2026-11-26)

| Record | Status | Detail |
|---|---|---|
| SPF | ❌ Missing | No `v=spf1` record |
| DKIM | ❌ Missing | No Google Workspace selector published |
| DMARC | ⚠️ `v=DMARC1; p=none` | Present but unenforced |
| MX | ⚠️ Namecheap forwarding | `eforward*.registrar-servers.com` — **Google Workspace is NOT set up on this domain** |

### Decision: stay on gmail.com, or move to Workspace

* **A. Stay on gmail.com (fine for now).** Zero setup. Downside: cold outreach
  from `...@gmail.com` to a CRO undercuts the enterprise-governance brand, and
  free Gmail spam-filters bulk sends aggressively. Acceptable for the 20/day
  dry-run/warmup while the prospect list is being enriched.
* **B. Google Workspace on `agenthivehq.com` (recommended before scaling).**
  The From domain is part of the governance story. Do this before flipping
  `OUTREACH_SEND_ENABLED=true` for real sends.

### Workspace setup steps (path B)

1. Buy Google Workspace, add `agenthivehq.com`, create `pradeep@agenthivehq.com`.
2. In Namecheap DNS, replace the MX records and add SPF/DKIM/DMARC (exact
   records below).
3. In Google Admin: **Apps → Google Workspace → Gmail → Authenticate email** →
   generate the DKIM record, then publish it in Namecheap.
4. Update backend config: `SMTP_USERNAME=pradeep@agenthivehq.com`,
   `OUTREACH_FROM_EMAIL=pradeep@agenthivehq.com`, and a new Gmail App Password
   in the `agenthive-smtp-password` secret. Redeploy.

### Exact Namecheap DNS records (paste once Workspace is provisioned)

```
# ── MX (replace the existing eforward*.registrar-servers.com records) ──
Type  Host  Value                              Priority
MX    @     aspmx.l.google.com.                1
MX    @     alt1.aspmx.l.google.com.           5
MX    @     alt2.aspmx.l.google.com.           5
MX    @     alt3.aspmx.l.google.com.           10
MX    @     alt4.aspmx.l.google.com.           10

# ── SPF ──
Type  Host  Value
TXT   @     v=spf1 include:_spf.google.com ~all

# ── DKIM (get the exact key from Google Admin → Authenticate email) ──
Type  Host                  Value
TXT   google._domainkey     v=DKIM1; k=rsa; p=<PASTE-FROM-GOOGLE-ADMIN>

# ── DMARC (start at quarantine once SPF+DKIM verified clean) ──
Type  Host      Value
TXT   _dmarc    v=DMARC1; p=quarantine; rua=mailto:pradeep@agenthivehq.com
```

> Note: the existing `google-site-verification` and `fah-claim` TXT records on
> `agenthivehq.com` must be left in place — do not delete them when adding SPF.

## Competitor suppression seed

Direct competitors are pre-suppressed at the domain level so nobody
accidentally sequences them: `zest.ai`, `scienaptic.ai`, `upstart.com`,
`fairplay.ai`, `stratyfy.com`, `pagaya.com`. Add more:

```bash
curl -X POST "$BASE/admin/suppressions?domain=competitor.com&reason=manual" \
  -H "X-Outreach-Admin-Key: $KEY"
```

## Cloud Scheduler

Job `outreach-sequencer-daily` runs `POST /admin/run-sequencer` at 14:00 UTC
(9am ET) weekdays. Manage:

```bash
gcloud scheduler jobs describe outreach-sequencer-daily --project=agenthivehq-landing
gcloud scheduler jobs run outreach-sequencer-daily --project=agenthivehq-landing   # manual trigger
```

## Env vars

| Var | Default | Notes |
|---|---|---|
| `OUTREACH_SEND_ENABLED` | `false` | Master switch. Dry-run when false. |
| `OUTREACH_FROM_NAME` | founder name | Display name on outbound mail |
| `OUTREACH_FROM_EMAIL` | `SMTP_USERNAME` | From address |
| `OUTREACH_DAILY_LIMIT` | `20` | Sends per UTC day |
| `OUTREACH_ADMIN_KEY` | — | Secret; admin API auth |
| `OUTREACH_PUBLIC_BASE_URL` | Cloud Run URL | Used in tracking/unsubscribe links |
| `OUTREACH_BOOKING_URL` | `agenthivehq.com/signup` | CTA destination |
| `SECRET_KEY` | — | Signs unsubscribe tokens (HMAC) |
