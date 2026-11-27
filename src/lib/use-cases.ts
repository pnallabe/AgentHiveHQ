// ---------------------------------------------------------------------------
// Use-Case Showcase — prospect-facing, interactive demos
//
// Each use case maps a real buyer pain point to a runnable underwriting
// scenario (backed by the live /api/underwriting/decision endpoint in
// demo_mode). The "Run live" action deep-links into the Product Lab with the
// scenario pre-selected.
// ---------------------------------------------------------------------------

export interface UseCaseMetric {
  label: string;
  value: string;
}

export interface UseCase {
  slug: string;
  /** Borrower persona / segment */
  persona: string;
  /** Buyer-facing headline */
  headline: string;
  /** The buyer's pain point */
  pain: string;
  /** How the platform addresses it */
  approach: string;
  /** What the live demo shows */
  demoShows: string[];
  /** Scenario id matching the Lab's ScenarioSelector / backend DEMO_RESPONSES */
  scenarioId: string;
  /** Expected decision outcome in demo mode */
  expectedDecision: "approve" | "reject" | "review";
  /** Illustrative outcome metrics (clearly labeled illustrative) */
  metrics: UseCaseMetric[];
  /** Tailwind accent classes */
  accent: string;
  badge: string;
}

export const USE_CASES: UseCase[] = [
  {
    slug: "governance-exam",
    persona: "Model Governance & Compliance",
    headline: "Pass SR 11-7 model-risk exams with a live audit trail",
    pain:
      "Model documentation and ongoing monitoring take weeks of staff time and still draw examiner findings.",
    approach:
      "Every decision is persisted with SHAP values, reason codes, and an immutable audit log — exportable as an examiner-ready pack in one click.",
    demoShows: [
      "Governance dashboard with approval-rate by segment",
      "Four-fifths / adverse-impact monitoring",
      "One-click tenant-scoped audit export",
    ],
    scenarioId: "high_risk",
    expectedDecision: "reject",
    metrics: [
      { label: "Exam prep time (illustrative)", value: "−96%" },
      { label: "Audit coverage", value: "100%" },
    ],
    accent: "text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  },
  {
    slug: "thin-file-inclusion",
    persona: "Thin-File Applicant",
    headline: "Approve credit-invisible borrowers without relaxing risk",
    pain:
      "Traditional bureau scores return no-hit or shallow files for a large share of applicants, forcing declines on otherwise creditworthy people.",
    approach:
      "Income-first modelling with SHAP explainability surfaces the cash-flow signals that drive each decision — so you can approve confidently and stay FCRA-compliant.",
    demoShows: [
      "Income-first scoring with no bureau score",
      "SHAP feature contributions for the review outcome",
      "FCRA adverse-action reason code for manual review",
    ],
    scenarioId: "thin_file",
    expectedDecision: "review",
    metrics: [
      { label: "Approval-rate lift (illustrative)", value: "+18%" },
      { label: "Time to decision", value: "< 1s" },
    ],
    accent: "text-violet-300",
    badge: "bg-violet-500/15 text-violet-300 ring-violet-500/40",
  },
  {
    slug: "gig-economy",
    persona: "Gig Economy Worker",
    headline: "Underwrite volatile income that bureau models miss",
    pain:
      "Gig borrowers default at higher rates at equivalent stated income — because volatility, not income level, is the real risk signal.",
    approach:
      "Employment-length-tolerant scoring plus a rules gate captures repayment capacity traditional models miss, with a full audit trail per decision.",
    demoShows: [
      "Approval despite non-traditional employment",
      "Real-time decision with credit limit + APR",
      "Immutable audit record for the decision",
    ],
    scenarioId: "gig_worker",
    expectedDecision: "approve",
    metrics: [
      { label: "Default reduction (illustrative)", value: "−31%" },
      { label: "Manual-review queue", value: "−82%" },
    ],
    accent: "text-amber-300",
    badge: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  },
  {
    slug: "new-to-country",
    persona: "New-to-Country Applicant",
    headline: "Serve high-income newcomers with zero US credit history",
    pain:
      "Recent immigrants with strong incomes are auto-declined by bureau-dependent models, a growing and underserved segment.",
    approach:
      "Thin-file routing sends these to a structured review with explainable factors, instead of a blind decline — expanding addressable market safely.",
    demoShows: [
      "Thin-file flag drives a review (not a blind decline)",
      "Explainable factor weights for the reviewer",
      "Compliant reason codes on the outcome",
    ],
    scenarioId: "new_immigrant",
    expectedDecision: "review",
    metrics: [
      { label: "Segment addressable (illustrative)", value: "+9%" },
      { label: "Regulatory findings", value: "0" },
    ],
    accent: "text-sky-300",
    badge: "bg-sky-500/15 text-sky-300 ring-sky-500/40",
  },
];

export function getUseCase(slug: string): UseCase | null {
  return USE_CASES.find((u) => u.slug === slug) ?? null;
}
